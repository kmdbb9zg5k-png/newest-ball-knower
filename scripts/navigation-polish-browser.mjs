/** CI-only browser review. Do not run a local browser in restricted work sessions. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.env.BK_NAV_REVIEW_ORIGIN || 'http://127.0.0.1:4173';
assert.ok(!new URL(origin).hostname.endsWith('ballknowerofficial.com'), 'Use the deterministic review fixture, never production data.');
const directory = process.env.BK_NAV_REVIEW_ARTIFACTS || 'artifacts/navigation-polish';
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [320, 375, 390, 768, 1366]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/navigation-review/index.html?scenario=active`);
    const primary = page.getByRole('navigation', { name: width < 768 ? 'Primary navigation' : 'Desktop primary navigation', exact: true });
    await primary.getByRole('button', { name: 'Play', exact: true }).waitFor();
    assert.equal(await primary.getByRole('button').count(), 5);
    for (const button of await primary.getByRole('button').all()) {
      const box = await button.boundingBox();
      assert.ok(box && box.width >= 44 && box.height >= 44, `${width}: practical primary targets`);
    }
    assert.equal(await page.getByRole('region', { name: 'Your next action' }).isVisible(), true);
    const nextAction = await page.getByRole('region', { name: 'Your next action' }).boundingBox();
    const promo = await page.getByRole('button', { name: 'Play Solo Mode', exact: true }).boundingBox();
    assert.ok(nextAction.y < promo.y, 'Continue must precede discovery promos');
    await page.screenshot({ path: `${directory}/home-${width}.png`, fullPage: true });
    await primary.getByRole('button', { name: 'Play', exact: true }).click();
    await page.getByTestId('play-hub').waitFor();
    assert.equal(await primary.getByRole('button', { name: 'Play', exact: true }).getAttribute('aria-current'), 'page');
    await page.getByRole('button', { name: 'Explore Mini Games', exact: true }).click();
    const games = page.getByRole('dialog', { name: 'Pick Your Game', exact: true });
    await games.waitFor();
    for (const label of ['Online Head-to-Head','Two-Minute Warning','Five-Minute Game','Combine Drills']) assert.equal(await games.getByRole('button', { name: new RegExp(label) }).count(), 1);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Explore Ball Knower', exact: true }).click();
    const explore = page.getByRole('dialog', { name: 'Explore Ball Knower', exact: true });
    await explore.waitFor();
    for (const label of ['Solo careers','Online football','Trivia','NFL picks','NFL news','Ask BK','Hall of Fame','Partners','Player locker','Create League','Join League','Roster Database','Replay Opening']) assert.equal(await explore.getByRole('button', { name: new RegExp(`^${label}`,'i') }).count(), 1, `${label} remains reachable`);
    await page.screenshot({ path: `${directory}/explore-${width}.png`, fullPage: true });
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Explore Ball Knower', exact: true }).evaluate(element => element === document.activeElement), true);
    await primary.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.getByTestId('locker-profile').waitFor();
    await page.getByText('550 XP to level 3', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Earned', exact: true }).click();
    assert.equal(await page.getByRole('list', { name: 'Trophies', exact: true }).getByRole('button').count(), 1);
    await page.getByRole('button', { name: 'Locked', exact: true }).click();
    assert.equal(await page.getByRole('list', { name: 'Trophies', exact: true }).getByRole('button').count(), 7);
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await page.screenshot({ path: `${directory}/profile-${width}.png`, fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}: no horizontal page overflow`);
    assert.deepEqual(errors, [], `${width}: no component runtime errors`);
    await page.close();
  }
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.goto(`${origin}/navigation-review/index.html?scenario=empty`);
  await page.getByRole('heading', { name: 'Your game starts here.', exact: true }).waitFor();
  await page.goto(`${origin}/navigation-review/index.html?scenario=draft`);
  await page.getByRole('button', { name: 'Enter Draft', exact: true }).waitFor();
  await page.goto(`${origin}/navigation-review/index.html?scenario=offline`);
  await page.getByRole('navigation', { name: 'Primary navigation', exact: true }).getByRole('button', { name: 'Profile', exact: true }).click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByRole('progressbar').count(), 0, 'failed profile sync must not invent XP progress');
  await page.close();
  console.log('Navigation review passed: five primaries, secondary routes, current actions, mini-games, trophy filters, empty/error states, practical targets and phone/desktop screenshots.');
} finally { await browser.close(); }
