import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from 'playwright';
import { mockCharacterPurchases } from './character-purchase-fixture.mjs';

const output = 'artifacts/character-practice';
await mkdir(output, { recursive: true });
const server = await preview({ preview: { host: '127.0.0.1', port: 4192, strictPort: true } });
const characters = [
  ['frostbite', 'Frostbite', 390], ['bkf-youngboy', 'BKF YoungBoy', 320],
  ['bkf-iron-wolf', 'Iron Wolf', 390], ['bkf-phantom', 'The Phantom', 320],
  ['bkf-outlaw', 'BKF Outlaw', 390], ['bk-femme', 'BKF Nicki', 320],
  ['bkf-lowrider', 'BKF Lowrider', 390], ['bkf-kickflip', 'BKF Kickflip', 320],
];
const ids = (process.env.BK_CHARACTER_PRACTICE_IDS || 'frostbite,bkf-youngboy').split(',');
assert.ok(ids.every(id => characters.some(([character]) => id === character)), 'Unknown practice character');
let browser;
try {
  browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  for (const [id, name, width] of characters.filter(([id]) => ids.includes(id))) {
    const context = await browser.newContext({
      viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block',
    });
    await mockCharacterPurchases(context, [{ sku: id, source: 'purchase', expires_at: null }]);
    await context.route('**/api/**', route => route.fulfill({ json: { available: false, tracks: [] } }));
    await context.addInitScript(() => {
      localStorage.setItem('ball-knower-team-setup-v2', 'complete');
      localStorage.setItem('ball-knower-intro-completed-v1', '2');
      localStorage.setItem('ballknower_solo_my_player_v2', JSON.stringify({
        version: 1, stage: 'combine', name: 'Preserve Me', position: 'WR', number: 21,
        combineId: 'character-practice-regression', overall: 68,
      }));
    });
    const page = await context.newPage();
    page.setDefaultTimeout(75000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.text().startsWith('[Combine startup:')) console.error(message.text());
    });
    await page.goto('http://127.0.0.1:4192/?storeCharacters=1');
    const card = page.locator(`[data-store-product="${id}"]`);
    await card.tap();
    const savedPlayer = await page.evaluate(() => localStorage.getItem('ballknower_solo_my_player_v2'));
    await page.getByRole('link', { name: 'Run the 40 as ' + name }).tap();
    await page.waitForURL('**/combine.html?drill=dash&character=' + id);

    const start = page.locator('.combine-hud:not([inert])').getByRole('button', { name: 'Start dash' });
    await start.waitFor();
    assert.equal(await start.isEnabled(), true);
    assert.equal(await page.locator('.combine-scene').getAttribute('data-character'), 'store-character');
    await page.getByText(name, { exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `${output}/${id}-start.png` });

    await start.tap();
    await page.locator('[data-phase="running"]').waitFor();
    await page.getByRole('button', { name: 'left stride' }).tap();
    await page.getByRole('button', { name: 'right stride' }).tap();
    await page.screenshot({ path: `${output}/${id}-running.png` });
    const results = page.getByRole('region', { name: 'Dash results' });
    await results.waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('ballknower_solo_my_player_v2')), savedPlayer);
    const result = await page.evaluate(() => JSON.parse(localStorage.getItem('bk-combine-forty-v1')).at(-1));
    assert.equal(result.playerId, 'store:' + id);
    assert.equal(result.context, 'character-practice');
    assert.ok(result.splits.every(Number.isFinite));
    await results.getByRole('button', { name: 'Back to Characters' }).tap();
    await card.waitFor();
    assert.deepEqual(errors, []);
    console.log(`PASS ${width}px ${name} Store launch, touch play, saved result, and return to Characters`);
    await context.close();
  }
} finally {
  await browser?.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
