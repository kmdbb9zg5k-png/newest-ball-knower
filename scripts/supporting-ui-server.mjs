import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareSupportingFixture, supportingOut } from './supporting-ui-fixture.mjs';

/** No browser or external service is started by this review server. */
// Let the OS choose an unoccupied ephemeral port. 4190 (Sieve) is forbidden by
// Fetch and WebKit even when a local HTTP server is listening successfully.
export async function startSupportingServer({ port = 0, host = '127.0.0.1' } = {}) {
  const html = await prepareSupportingFixture();
  const requests = [];
  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://fixture').pathname;
    const request = { pathname, status: null, completed: false };
    requests.push(request);
    res.once('finish', () => { request.status = res.statusCode; request.completed = true; });
    if (pathname === '/') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(html);
      return;
    }
    // Serve only generated review files and the compiled application styles.
    if (!pathname.startsWith(`/${supportingOut}/`) && !pathname.startsWith('/dist/assets/')) {
      res.writeHead(404).end();
      return;
    }
    try {
      const bytes = await readFile(resolve('.', `.${pathname}`));
      res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' })[extname(pathname)] || 'application/octet-stream');
      res.setHeader('Content-Length', bytes.length);
      res.end(bytes);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  const origin = `http://${host}:${server.address().port}`;
  // Verify HTTP before launching an engine, so server failures cannot be
  // misreported as browser readiness failures.
  const probe = await fetch(origin, { signal: AbortSignal.timeout(5_000) });
  if (!probe.ok || !(await probe.text()).includes('/fixture.js')) {
    await new Promise(resolve => server.close(resolve));
    throw Error('Supporting fixture HTTP readiness failed.');
  }
  return { server, origin, requests };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { origin } = await startSupportingServer({ port: Number(process.env.PORT || 0), host: process.env.HOST || '127.0.0.1' });
  console.log(`Supporting UI review ready: ${origin}/ (instructions), ${origin}/?mode=ask (Ask BK)`);
}
