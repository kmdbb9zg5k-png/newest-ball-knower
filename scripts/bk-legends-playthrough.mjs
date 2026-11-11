import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { CAMPAIGN } from '../bkLegends.ts';

const base = 'http://127.0.0.1:4335';
const out = 'artifacts/bk-legends-playthrough';
await mkdir(out, { recursive: true });
const preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4335', '--strictPort'], { stdio: 'inherit' });
let browser;
let page;
let context;
const report = { rounds: [], errors: [], controls: [], captureWarnings: [] };
const requestedRounds = Number(process.env.BK_LEGENDS_ROUNDS ?? 3);
assert.ok(Number.isInteger(requestedRounds) && requestedRounds >= 1 && requestedRounds < CAMPAIGN.length, 'Invalid campaign round limit');
async function capture(name) {
  if (!page) return;
  try {
    await page.screenshot({ path: out + '/' + name + '.png', timeout: 6000 });
  } catch (error) {
    report.captureWarnings.push({ name, reason: error.message.split('\n')[0] });
  }
}

try {
  for (let tries = 0; tries < 80; tries++) {
    if (await fetch(base).then(r => r.ok).catch(() => false)) break;
    assert.ok(tries < 79 && preview.exitCode === null, 'Preview server failed');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || undefined,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  context = await browser.newContext({
    viewport: { width: 844, height: 470 }, hasTouch: true,
    recordVideo: { dir: out, size: { width: 640, height: 356 } },
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
  const homeCover = page.locator('.bk-journey-dialog + .bk-home-legends-cover')
    .and(page.getByRole('button', { name: 'Play BK Legends', exact: true }));
  assert.equal(await page.getByRole('heading', { name: 'Your game starts here.', exact: true }).count(), 0);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await homeCover.scrollIntoViewIfNeeded();
    await homeCover.locator('img').evaluate(image => image.decode());
    const bounds = await homeCover.boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1, 'Home cover overflows at ' + width);
  }
  await homeCover.click();
  await legends.waitFor();
  await legends.locator('.bkl-header').getByRole('button', { name: 'Back', exact: true }).click();
  await homeCover.click();
  await legends.waitFor();
  await legends.getByRole('button', { name: /Open free Starter Pack/ }).click();
  await legends.getByText('0 / 80 complete', { exact: true }).waitFor();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Campaign overflows at ' + width);
    await capture('campaign-' + width);
  }
  await page.setViewportSize({ width: 844, height: 470 });

  async function playChallenge({ title, ball, clock, attackEndZone, passTarget = 0, rushTarget = 0 }, retry = false) {
    console.log('Starting', title);
    const slug = title.toLowerCase().replaceAll(/[^a-z]+/g, '-');
    await legends.getByRole('button', { name: 'Play challenge', exact: true }).click();
    const iframe = page.locator('iframe[title="BK Legends 3D football field"]');
    await iframe.waitFor();
    const handle = await iframe.elementHandle();
    const field = await handle.contentFrame();
    await field.waitForFunction(() => window.bk3dDiagnostics?.().athletes.ready, null, { timeout: 60_000 });
    const resultHeading = page.getByRole('dialog', { name: title }).getByRole('heading', { name: /Challenge cleared|Objective incomplete/ });
    const state = () => field.evaluate(() => window.bk3dDiagnostics());
    const fieldInput = async (id, event, init) => {
      await field.evaluate(({ id, event, init }) => {
        const target = document.getElementById(id);
        if (!target) throw new Error('Missing field control: ' + id);
        target.dispatchEvent(event.startsWith('key') ? new KeyboardEvent(event, { ...init, bubbles: true }) : new PointerEvent(event, { ...init, bubbles: true }));
      }, { id, event, init });
    };
    const step = async seconds => {
      try { await field.evaluate(s => window.bk3dTest.step(s), seconds); }
      catch (error) { if (!field.isDetached()) throw error; }
    };
    const click = async id => {
      const control = field.locator('#' + id);
      await control.waitFor({ state: 'visible', timeout: 20_000 });
      assert.equal(await control.isEnabled(), true, id + ' is disabled');
      // Activate the same in-game button without waiting for a software-rendered pointer frame.
      await field.evaluate(id => {
        const button = document.getElementById(id);
        if (!button || button.disabled) throw new Error('Unavailable control: ' + id);
        button.click();
      }, id);
      report.controls.push(id);
    };
    const visible = id => field.locator('#' + id).isVisible();
    const initial = await state();
    assert.equal(initial.drive.clock, clock);
    assert.equal(initial.drive.ball, ball);
    const roundStarted = Date.now();
    assert.equal(initial.players[5].teamAbbr, 'BKL');
    await field.evaluate(() => window.bkSetGraphicsQualityForQA('eco'));
    let kicked = false, liveDefense = 0;
    await capture(slug + '-playbook');
    try {
      for (let action = 0; action < 200; action++) {
        assert.ok(Date.now() - roundStarted < 9 * 60_000, title + ' exceeded its playthrough time budget');
        if (await resultHeading.isVisible()) return;
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
            liveDefense++;
          } else {
            await click('unitSimBook');
          }
        } else if (current.unit) {
          await step(3);
        } else if (current.playbook.open) {
          if (current.mini.conversion === 'home') await click('breakHuddle');
          else if ((!attackEndZone || current.mini.overtime) && (!kicked || current.mini.overtime) && current.mini.stats.home.passYards >= passTarget && current.mini.stats.home.rushYards >= rushTarget && await visible('fullFieldGoal') && await field.locator('#fullFieldGoal').isEnabled()) {
            await click('fullFieldGoal');
            kicked = true;
          } else {
            if (current.mini.stats.home.passYards < passTarget || (attackEndZone && current.mini.stats.home.rushYards >= rushTarget)) {
              await click('filterPass');
              await click(retry ? 'call-pass-2' : 'call-pass-1');
            } else if (current.mini.stats.home.rushYards < rushTarget) {
              await click('filterRun');
              await click(retry ? 'call-run-3' : 'call-run-1');
            }
            await click('breakHuddle');
          }
        } else if (current.phase === 'pre') {
          await fieldInput('snap', 'pointerdown', { pointerId: 1, pointerType: 'touch', button: 0, isPrimary: true });
          report.controls.push('snap');
          if (current.mode === 'run') {
            await fieldInput('game', 'keydown', { key: 'ArrowUp', code: 'ArrowUp' });
            await step(5);
            if (!field.isDetached() && !await resultHeading.isVisible()) await fieldInput('game', 'keyup', { key: 'ArrowUp', code: 'ArrowUp' });
          } else await step(1.45);
        } else if (current.phase === 'pass' && !current.throwing) {
          const targets = current.players.filter((player, index) => [7, 8, 9, 10, 6].includes(index) && !player.fallen);
          const defense = current.players.filter(player => player.team === 1 && !player.fallen);
          const score = player => Math.min(...defense.map(d => Math.hypot(d.x - player.x, d.z - player.z))) +
            .25 * Math.max(0, player.z - current.field.scrimmage);
          targets.sort((a, b) => score(b) - score(a));
          const target = current.players.indexOf(targets[0]);
          const input = field.locator('#target-' + target);
          if (await input.isVisible()) {
            await field.evaluate(index => document.getElementById('target-' + index)?.click(), target);
            report.controls.push('pass:' + target);
          }
          await step(3);
        } else if (current.phase === 'cpu' && await visible('fullNext')) {
          await click('fullNext');
        } else {
          await step(5);
        }
      }
    } catch (error) {
      // The app replaces the field with the real result as soon as the game posts it.
      // A browser request already in flight can see that removal before its reply arrives.
      if (!field.isDetached() && !await resultHeading.isVisible()) throw error;
      await resultHeading.waitFor({ timeout: 5000 });
      return;
    }
    throw new Error(title + ' did not reach a result within the control budget');
  }

  const rounds = CAMPAIGN.slice(0, requestedRounds).map((scenario, index) => ({
    title: scenario.title,
    ball: scenario.defending ? 25 : scenario.ball,
    clock: scenario.clock,
    attackEndZone: scenario.goal === 'win' && scenario.id !== 0,
    passTarget: scenario.goal === 'pass' ? scenario.target : 0,
    rushTarget: scenario.goal === 'rush' ? scenario.target : 0,
    next: CAMPAIGN[index + 1].title,
  }));
  for (const [index, round] of rounds.entries()) {
    await playChallenge(round);
    const result = page.getByRole('dialog', { name: round.title });
    await result.getByRole('heading', { name: /Challenge cleared|Objective incomplete/ }).waitFor();
    const cleared = result.getByRole('heading', { name: 'Challenge cleared', exact: true });
    if (!await cleared.isVisible()) {
      report.rounds.push({ challenge: round.title, attempt: 1, result: await result.innerText() });
      await capture('round-' + (index + 1) + '-retry');
      await result.getByRole('button', { name: 'Back to BK Legends' }).click();
      await playChallenge(round, true);
      await result.getByRole('heading', { name: /Challenge cleared|Objective incomplete/ }).waitFor();
    }
    const text = await result.innerText();
    report.rounds.push({ challenge: round.title, result: text });
    await writeFile(out + '/report.json', JSON.stringify(report, null, 2));
    console.log(text);
    await capture('round-' + (index + 1) + '-result');
    await result.getByRole('heading', { name: 'Challenge cleared', exact: true }).waitFor({ timeout: 1500 });
    await result.getByText('+1,000 BK Coins', { exact: true }).waitFor();
    await result.getByLabel('Challenge stats', { exact: true }).waitFor();
    await result.getByRole('button', { name: 'Back to BK Legends' }).click();
    await legends.getByText((index + 1) + ' / 80 complete', { exact: true }).waitFor();
    await legends.getByRole('heading', { name: round.next, exact: true }).waitFor();
    await page.reload();
    await enterLegends();
    await legends.getByText((index + 1) + ' / 80 complete', { exact: true }).waitFor();
    assert.match(await legends.locator('.bkl-header').innerText(), new RegExp((index + 1) + ',000'));
    await legends.getByRole('heading', { name: round.next, exact: true }).waitFor();
  }
  if (requestedRounds >= 10) {
    await legends.getByRole('button', { name: /Training Camp/ }).click();
    const chapter = legends.getByRole('heading', { name: 'Chapter Pack', exact: true });
    await chapter.waitFor();
    await legends.getByRole('button', { name: 'Claim', exact: true }).first().click();
    await legends.getByText('Chapter Pack claimed.', { exact: true }).waitFor();
    report.chapterPackClaimed = true;
  }
  assert.deepEqual(report.errors, []);
  console.log(JSON.stringify(report));
} catch (error) {
  report.failure = String(error);
  console.error(JSON.stringify(report));
  await capture('failure');
  throw error;
} finally {
  await writeFile(out + '/report.json', JSON.stringify(report, null, 2));
  await context?.close();
  await browser?.close();
  preview.kill();
}
