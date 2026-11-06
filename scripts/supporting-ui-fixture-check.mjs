// Static/HTTP readiness only. Browser behavior remains covered by the CI suite.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startSupportingServer } from './supporting-ui-server.mjs';
import { supportingOut } from './supporting-ui-fixture.mjs';

// Exercise the identical default origin used by the browser suite. Overriding
// the port here would miss a forbidden default even with valid static files.
const { server, origin } = await startSupportingServer();
try {
  assert.notEqual(new URL(origin).port, '4190', 'The default must avoid the Fetch/WebKit Sieve port restriction.');
  const html = await (await fetch(origin)).text();
  const meta = JSON.parse(await readFile(`${supportingOut}/bundle-meta.json`, 'utf8'));
  const files = new Map(Object.entries(meta.outputs).map(([file, output]) => [`/${file}`, output.bytes]));
  for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
    if (!files.has(href)) files.set(href, null);
  }
  const queue = [...files];
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (queue.length) {
      const [url, expectedBytes] = queue.pop();
      const response = await fetch(`${origin}${url}`, { signal: AbortSignal.timeout(5_000) });
      assert.equal(response.status, 200, `${url} must be served`);
      assert.match(response.headers.get('content-type') || '', url.endsWith('.css') ? /text\/css/ : /text\/javascript/);
      const bytes = (await response.arrayBuffer()).byteLength;
      assert(bytes > 0, `${url} must not be empty`);
      if (expectedBytes !== null) assert.equal(bytes, expectedBytes, `${url} must not be truncated`);
    }
  }));
  assert.equal((await fetch(`${origin}/AskBkHub.tsx`)).status, 404);
  console.log(`PASS supporting fixture HTTP readiness: all ${files.size} split modules and styles served completely with correct MIME types; source files are unavailable.`);
} finally {
  await new Promise(resolve => server.close(resolve));
}
