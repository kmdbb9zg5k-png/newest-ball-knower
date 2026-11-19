import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { mockCharacterPurchases } from './character-purchase-fixture.mjs';

const base = 'https://ballknowerofficial.com';
const output = 'artifacts/live-nicki';
const drills = process.argv.slice(2);
assert.ok(drills.length > 0);
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    serviceWorkers: 'block',
  });
  await mockCharacterPurchases(context, [{ sku: 'bk-femme', source: 'purchase', expires_at: null }], [], {
    character: 'bk-femme', position: 'RB', heightInches: 72, weightLbs: 205,
  });
  await context.route('**/api/**', route => route.fulfill({ json: { available: false, tracks: [] } }));
  await context.route('**/_vercel/**', route => route.abort());
  // Reuse bytes from the live model host across drills. Each page still decodes
  // and renders the model through the production code.
  let liveModel;
  await context.route(/https:\/\/v3b\.fal\.media\/.*7V-fQltpUHPX18nf2I0aG_model\.glb$/, async route => {
    liveModel ??= context.request.get(route.request().url(), { timeout: 90000 }).then(async response => {
      assert.ok(response.ok(), 'Live model asset must be available');
      const bytes = await response.body();
      assert.equal(bytes.subarray(0, 4).toString(), 'glTF');
      return bytes;
    });
    await route.fulfill({ body: await liveModel, contentType: 'model/gltf-binary' });
  });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && message.text().includes('Combine startup:')) console.error(message.text());
  });

  if (drills.includes('dash')) {
    await page.goto(base + '/combine.html?create=1');
    const setup = page.getByRole('region', { name: 'Equipped character' });
    await setup.getByRole('img', { name: 'BKF Nicki', exact: true }).waitFor();
    await page.screenshot({ path: output + '/setup.png' });
    console.log('PASS live setup shows BKF Nicki from the account');
  }

  for (const drill of drills) {
    await page.goto(base + '/combine.html?drill=' + drill);
    const scene = page.locator('.combine-scene[data-character="store-character"]');
    await scene.locator('canvas').waitFor();
    await page.getByText(/BKF Nicki/).first().waitFor();
    await page.getByRole('dialog', { name: 'Preparing Combine' }).waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.combine-scene[data-character="native-athlete"]').count(), 0);
    await page.screenshot({ path: output + '/' + drill + '.png' });
    console.log('PASS live', drill, 'loaded and rendered BKF Nicki');

    if (drill === 'dash') {
      await page.getByRole('button', { name: 'Start dash', exact: true }).tap();
      await page.locator('[data-phase="running"]').waitFor();
      await page.getByRole('button', { name: 'left stride' }).tap();
      await page.getByRole('button', { name: 'right stride' }).tap();
      await page.getByRole('region', { name: 'Dash results' }).waitFor({ timeout: 150000 });
      const record = await page.evaluate(() => JSON.parse(localStorage.getItem('bk-combine-forty-v1')).at(-1));
      assert.equal(record.playerId, 'store:bk-femme');
      assert.ok(record.splits.every(Number.isFinite));
      await page.screenshot({ path: output + '/dash-result.png' });
      console.log('PASS live dash completed with a Nicki result in the isolated browser');
    }
  }
  assert.ok(liveModel, 'The browser must fetch the real Nicki model');
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
