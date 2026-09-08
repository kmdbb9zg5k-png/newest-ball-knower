import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const baseURL = 'http://127.0.0.1:4175';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4175', '--strictPort'], { stdio: 'inherit' });
let browser;
async function ready() {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error(`Preview exited: ${server.exitCode}`);
    try { if ((await fetch(baseURL)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Preview did not become ready');
}
try {
  await ready();
  await mkdir('artifacts/favorite-team', { recursive: true });
  browser = await chromium.launch({ headless: true });
  for (const width of [320, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const crashes = [], logoRequests = [];
    const failedCodes = new Set();
    page.on('pageerror', error => crashes.push(error.message));
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const payload = path === '/api/media' ? { tracks: [], introUrl: null } : { ok: true };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
    });
    await page.route('**/_vercel/**', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
    // Deterministic image fixtures exercise rendering/failure, not live CDN availability or rights.
    await page.route(/https:\/\/a\.espncdn\.com\/i\/teamlogos\/nfl\/500\/[^/]+\.png/, async route => {
      const code = new URL(route.request().url()).pathname.split('/').pop().replace('.png', '');
      logoRequests.push(code);
      if (failedCodes.has(code)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><circle cx="128" cy="128" r="100" fill="#a5acaf"/><text x="128" y="140" text-anchor="middle" font-size="40">${code.toUpperCase()}</text></svg>` });
    });
    await page.addInitScript(() => {
      localStorage.setItem('ball-knower-intro-completed-v1', '1');
      localStorage.setItem('ball-knower-intro-sound-v1', 'off');
    });
    await page.goto(`${baseURL}/?teamsetup=1`, { waitUntil: 'domcontentloaded' });
    const notice = page.getByTestId('favorite-team-notice');
    await notice.waitFor();
    assert.equal(await page.locator('button img[data-favorite-team-logo]').count(), 5, 'Preserve neighboring cards');
    const teams = new Set();
    for (let count = 0; count < 32; count++) {
      const name = await page.locator('h2').innerText();
      teams.add(name);
      const image = page.getByRole('img', { name: `${name} logo`, exact: true });
      assert.match(await image.getAttribute('src'), /^https:\/\/a\.espncdn\.com\/i\/teamlogos\/nfl\/500\//);
      await image.evaluate(element => element.decode());
      await page.getByRole('button', { name: 'Next team', exact: true }).click();
    }
    assert.equal(teams.size, 32, 'Every team must remain selectable');
    assert.equal(new Set(logoRequests).size, 32, 'Request all 32 logo assets, including Washington');
    assert.ok(logoRequests.includes('wsh'));
    await page.screenshot({ path: `artifacts/favorite-team/selector-${width}.png` });
    await notice.scrollIntoViewIfNeeded();
    const box = await notice.boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= 845, 'Footer must be readable inside the phone viewport');
    assert.ok(await notice.evaluate(element => element.scrollWidth <= element.clientWidth + 1));
    assert.ok(await notice.evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 12));
    const skipBox = await page.getByRole('button', { name: 'SKIP FOR NOW', exact: true }).boundingBox();
    assert.ok(skipBox && skipBox.y + skipBox.height <= box.y, 'Notice belongs below the selection buttons');
    assert.match(await notice.innerText(), /We’d like to know your favorite team/);
    assert.match(await notice.innerText(), /not affiliated with, endorsed by, or sponsored by the NFL/);
    await page.screenshot({ path: `artifacts/favorite-team/footer-${width}.png` });

    failedCodes.add('pit');
    await page.evaluate(() => localStorage.setItem('ball-knower-favorite-team', 'Pittsburgh Steelers'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    const fallback = page.getByRole('img', { name: 'Pittsburgh Steelers logo', exact: true });
    await page.waitForFunction(() => document.querySelector('img[alt="Pittsburgh Steelers logo"]')?.getAttribute('src')?.startsWith('data:image/svg+xml,'));
    await fallback.evaluate(element => element.decode());
    await page.getByRole('button', { name: 'Next team', exact: true }).click();
    const nextLogo = page.getByRole('img', { name: 'San Francisco 49ers logo', exact: true });
    assert.match(await nextLogo.getAttribute('src'), /\/sf\.png$/);
    assert.match(await page.locator('img[data-favorite-team-logo][aria-hidden="true"]').getAttribute('src'), /\/sf\.png$/, 'Background must recover after switching away from a failed logo');
    await page.getByRole('button', { name: 'CONFIRM SF', exact: true }).click();
    await notice.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => localStorage.getItem('ball-knower-favorite-team')), 'San Francisco 49ers');
    assert.equal(await page.evaluate(() => localStorage.getItem('ball-knower-team-setup-v2')), 'complete');
    const requestCount = logoRequests.length;
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.locator('.bk-app-shell[data-tab="home"]').waitFor();
    assert.equal(await notice.count(), 0, 'Confirmed choice survives reload');
    assert.equal(logoRequests.length, requestCount, 'Official logo restoration must remain scoped to the selector');
    await page.goto(`${baseURL}/?teamsetup=1`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'SKIP FOR NOW', exact: true }).click();
    await notice.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => localStorage.getItem('ball-knower-team-setup-v2')), 'skipped');
    assert.deepEqual(crashes, []);
    await context.close();
  }
  console.log('Favorite-team browser checks passed at 320/390/430px: all 32 selections, reachable footer, image failure/recovery, confirm persistence, skip and scoped logo requests. Image responses were fixtures.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
