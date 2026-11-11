import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4335';
const out = 'artifacts/bk-legends-playthrough';
await mkdir(out, { recursive: true });
const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4335', '--strictPort'], { stdio: 'inherit' });
let browser;
let page;
let context;
const report = { rounds: [], errors: [], controls: [] };

try {
  for (let tries = 0; tries < 80; tries++) {
    if (await fetch(base).then(r => r.ok).catch(() => false)) break;
    assert.ok(tries < 79 && preview.exitCode === null, 'Preview server failed');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || undefined,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  context = await browser.newContext({
    viewport: { width: 1040, height: 525 }, hasTouch: true,
    recordVideo: { dir: out, size: { width: 1040, height: 525 } },
  });
  page = await context.newPage();
  page.on('pageerror', error => report.errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { tracks: [], games: [], articles: [] } });
    if (url.pathname === '/play-moment-3d-preview.html' && url.searchParams.has('bkLegends') && !url.searchParams.has('qa')) {
      // Only enable the clock-step and read-only diagnostics used by the existing review harness.
      // The game still determines the final score and sends its own result.
      url.searchParams.set('qa', '1');
      url.searchParams.set('manualFrames', '1');
      return route.fulfill({ status: 307, headers: { location: url.href } });
    }
    return route.continue();
  });
  await page.addInitScript(() => {
    localStorage.setItem('ball-knower-intro-completed-v1', '2');
    localStorage.setItem('ball-knower-team-setup-v2', 'complete');
    localStorage.setItem('ball-knower-intro-sound-v1', 'off');
  });
  await page.goto(base);
  assert.equal(await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2'))), true, 'Runner has no WebGL2');
  const legends = page.getByTestId('bk-legends');
  async function enterLegends() {
    await page.getByRole('button', { name: 'Explore Ball Knower' }).click();
    await page.getByRole('button', { name: 'BK Legends Build a squad and play Road to Legend' }).click();
    await legends.waitFor();
  }
  await enterLegends();
  await legends.getByRole('button', { name: /Open free Starter Pack/ }).click();
  await legends.getByText('0 / 80 complete', { exact: true }).waitFor();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Campaign overflows at ' + width);
    await page.screenshot({ path: out + '/campaign-' + width + '.png' });
  }
  await page.setViewportSize({ width: 1040, height: 525 });

  async function playFirstSnap() {
    await legends.getByRole('button', { name: 'Play challenge', exact: true }).click();
    const iframe = page.locator('iframe[title="BK Legends 3D football field"]');
    await iframe.waitFor();
    const handle = await iframe.elementHandle();
    const field = await handle.contentFrame();
    await field.waitForFunction(() => window.bk3dDiagnostics?.().athletes.ready, null, { timeout: 60_000 });
    const state = () => field.evaluate(() => window.bk3dDiagnostics());
    const step = seconds => field.evaluate(s => window.bk3dTest.step(s), seconds);
    const click = async id => {
      await field.locator('#' + id).click({ timeout: 8000 });
      report.controls.push(id);
    };
    const visible = id => field.locator('#' + id).isVisible();
    const initial = await state();
    assert.equal(initial.drive.clock, 45);
    assert.equal(initial.drive.ball, 90);
    assert.equal(initial.players[5].teamAbbr, 'BKL');
    let kicked = false, liveDefense = 0;
    await page.screenshot({ path: out + '/first-snap-playbook.png' });
    for (let action = 0; action < 200; action++) {
      if (await page.getByRole('heading', { name: /Challenge cleared|Objective incomplete/ }).isVisible()) return;
      if (field.isDetached()) return;
      const current = await state();
      assert.equal(current.glError, 0);
      if (current.ended) return;
      if (current.paused) {
        await click('resume');
      } else if (current.unit?.stage === 'kick' && current.unit.kicking === 'home') {
        if (!current.unit.timing) await click('unitKickButton');
        await step(.75);
        await click('unitKickButton');
        await step(2);
      } else if (current.unit?.kind === 'defense' && current.unit.book) {
        if (liveDefense === 0) {
          await click('unitCallDefense');
          await click('defenseReady');
          await step(.8);
          await page.screenshot({ path: out + '/first-snap-defense.png' });
          liveDefense++;
        } else {
          await click('unitSimBook');
        }
      } else if (current.unit) {
        await step(3);
      } else if (current.playbook.open) {
        if (current.mini.conversion === 'home') await click('breakHuddle');
        else if ((!kicked || current.mini.overtime) && await visible('fullFieldGoal') && await field.locator('#fullFieldGoal').isEnabled()) {
          await click('fullFieldGoal');
          kicked = true;
        } else await click('breakHuddle');
      } else if (current.phase === 'pre') {
        await field.locator('#snap').dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', button: 0, isPrimary: true });
        report.controls.push('snap');
        await step(5);
      } else if (current.phase === 'cpu' && await visible('fullNext')) {
        await click('fullNext');
      } else {
        await step(5);
      }
    }
    throw new Error('First Snap did not reach a result within the control budget');
  }

  await playFirstSnap();
  const result = page.getByRole('dialog', { name: 'First Snap' });
  await result.getByRole('heading', { name: /Challenge cleared|Objective incomplete/ }).waitFor();
  report.rounds.push({ challenge: 'First Snap', result: await result.innerText() });
  await page.screenshot({ path: out + '/first-snap-result.png' });
  await result.getByRole('heading', { name: 'Challenge cleared', exact: true }).waitFor({ timeout: 1500 });
  await result.getByText('+1,000 BK Coins', { exact: true }).waitFor();
  await result.getByRole('button', { name: 'Back to BK Legends' }).click();
  await legends.getByText('1 / 80 complete', { exact: true }).waitFor();
  await legends.getByRole('heading', { name: 'Find Your Receiver', exact: true }).waitFor();
  await page.reload();
  await enterLegends();
  await legends.getByText('1 / 80 complete', { exact: true }).waitFor();
  assert.match(await legends.locator('.bkl-header').innerText(), /1,000/);
  await legends.getByRole('heading', { name: 'Find Your Receiver', exact: true }).waitFor();
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify(report));
} catch (error) {
  report.failure = String(error);
  await page?.screenshot({ path: out + '/failure.png' }).catch(() => {});
  throw error;
} finally {
  await writeFile(out + '/report.json', JSON.stringify(report, null, 2));
  await context?.close();
  await browser?.close();
  preview.kill();
}
