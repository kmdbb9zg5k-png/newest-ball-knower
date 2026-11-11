import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.BK_BROWSER_URL ?? 'http://127.0.0.1:4335';
const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || undefined, headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
try {
  await mkdir('artifacts/bk-legends', { recursive: true });
  for (const width of [320, 390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: width < 768, hasTouch: width < 768 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*.supabase.co/**', route => route.fulfill({ status: 403, json: {} }));
    await page.route('**/_vercel/**', route => route.fulfill({ body: '' }));
    await page.route('**/api/**', route => route.fulfill({ json: { tracks: [], games: [], articles: [] } }));
    await page.addInitScript(() => {
      localStorage.setItem('ball-knower-intro-completed-v1','2');
      localStorage.setItem('ball-knower-team-setup-v2','complete');
      localStorage.setItem('ball-knower-intro-sound-v1','off');
    });
    await page.goto(base);
    const openLegends = async () => {
      for (const button of await page.getByRole('button', { name: 'Play', exact: true }).all()) {
        if (await button.isVisible()) { await button.click(); break; }
      }
      await page.getByRole('button', { name: /Build your squad BK Legends/ }).click();
    };
    await openLegends();
    await page.getByRole('button', { name: /Open free Starter Pack/ }).click();
    await page.getByText('0 / 80 complete', { exact: true }).waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: 'artifacts/bk-legends/campaign-' + width + '.png' });
    await page.getByRole('button', { name: 'My Squad', exact: true }).click();
    await page.getByRole('heading', { name: 'Manage QB' }).waitFor();
    await page.getByRole('button', { name: 'Defense', exact: true }).click();
    await page.getByRole('heading', { name: 'Manage LB' }).waitFor();
    await page.getByRole('button', { name: 'Packs', exact: true }).click();
    assert.ok(await page.getByRole('button', { name: /Get WR Pack/ }).isDisabled());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));

    if (width === 390) {
      await page.getByRole('button', { name: 'Campaign', exact: true }).click();
      await page.setViewportSize({ width: 844, height: 390 });
      await page.getByRole('button', { name: 'Play challenge' }).click();
      const frame = page.frameLocator('iframe[title="BK Legends 3D football field"]');
      await frame.locator('#breakHuddle').waitFor({ timeout: 45000 });
      assert.equal(await frame.locator('#score').textContent(), '21');
      assert.equal(await frame.locator('#clock').textContent(), '0:45');
      await frame.locator('#breakHuddle').click();
      await frame.locator('#snap').click();
      await frame.locator('#snap').waitFor({ state: 'hidden' });
      const contents = await (await page.locator('iframe[title="BK Legends 3D football field"]').elementHandle()).contentFrame();
      // Inject the final whistle at the bridge boundary. No production override is present.
      await contents.evaluate(() => {
        const token = new URLSearchParams(location.search).get('bkLegends');
        parent.postMessage({ type: 'bk-legends-result', token: 'wrong-token',
          result: { homeScore: 28, awayScore: 21, passYards: 10, rushYards: 0, plays: 2 } }, location.origin);
      });
      assert.equal(await page.getByRole('heading', { name: 'Challenge cleared' }).count(), 0);
      await contents.evaluate(() => {
        const token = new URLSearchParams(location.search).get('bkLegends');
        const message = { type: 'bk-legends-result', token,
          result: { homeScore: 28, awayScore: 21, passYards: 10, rushYards: 0, plays: 2 } };
        parent.postMessage(message, location.origin);
        parent.postMessage(message, location.origin);
      });
      await page.getByRole('heading', { name: 'Challenge cleared' }).waitFor();
      await page.getByRole('button', { name: 'Back to BK Legends' }).click();
      await page.getByText('1 / 80 complete', { exact: true }).waitFor();
      assert.match(await page.locator('.bkl-header').innerText(), /1,000/);
      await page.reload();
      await openLegends();
      await page.getByText('1 / 80 complete', { exact: true }).waitFor();
      await page.getByRole('heading', { name: 'Find Your Receiver', exact: true }).waitFor();
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('BK Legends browser: 320px, 390px and 1280px; starter, roster, pack eligibility, real field snap, result delivery, duplicate rejection, and reload.');
} finally {
  await browser.close();
}
