// Exercise the same saved-athlete entry shown to guests before each drill.
export async function enterCombineSetup(page) {
  const start = page.getByRole('button', {name: /^Save & start /});
  await start.waitFor({state:'visible',timeout:90000});
  await start.click();
  console.log('Saved-athlete setup complete');
}

// Static production builds avoid compiling six independent Vite dependency graphs
// when auditing drills on a memory-constrained software renderer.
export async function createServer(options) {
  if (!process.env.BK_DRILL_DIST) return (await import('vite')).createServer(options);
  const {createServer: httpServer} = await import('node:http');
  const {readFile} = await import('node:fs/promises');
  const {resolve, extname, sep} = await import('node:path');
  const root = resolve(process.env.BK_DRILL_DIST);
  const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
  const server = httpServer(async (req,res) => {
    const file = resolve(root, '.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if (!file.startsWith(root+sep)) {res.writeHead(403).end();return;}
    try {res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'}).end(await readFile(file));}
    catch {res.writeHead(404).end();}
  });
  return {listen:()=>new Promise(resolve=>server.listen(options.server.port,'127.0.0.1',resolve)),close:()=>new Promise(resolve=>server.close(resolve))};
}
