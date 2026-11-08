import assert from 'node:assert/strict';
import {preview} from 'vite';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {SOLO_PLAYERS_DATABASE} from '../soloUniverse.ts';
import {DEFAULT_SALARY_CAP} from '../types.ts';
import {validateRosterShape} from '../rosterRules.ts';
const width = Number(process.env.BK_QA_WIDTH || 390);
const port = Number(process.env.BK_QA_PORT || 4194);
const base = `http://127.0.0.1:${port}`;
const server = await preview({ preview: { host: '127.0.0.1', port, strictPort: true } });
const bundledBrowser = process.env.BK_CHROMIUM_MODULE ? (await import(process.env.BK_CHROMIUM_MODULE)).default : null;
const browser = await chromium.launch({
  headless: true,
  executablePath: bundledBrowser ? await bundledBrowser.executablePath() : process.env.BROWSER_PATH,
  args: bundledBrowser ? bundledBrowser.args : ['--no-sandbox'],
});
const page = await browser.newPage({
  viewport: { width, height: 844 },
  isMobile: width < 600,
  hasTouch: width < 600,
  reducedMotion: 'reduce',
});
try {
  page.setDefaultTimeout(20000);
  const user = {
    id: '00000000-0000-4000-8000-000000000401',
    is_anonymous: true,
    aud: 'authenticated',
    role: 'authenticated',
    user_metadata: {},
    app_metadata: {},
    created_at: new Date().toISOString(),
  };
  const claims = { sub: user.id, exp: Math.floor(Date.now() / 1000) + 86400, role: 'authenticated' };
  const token = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.qa';
  await page.route('**/*.supabase.co/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/v1/user')) return route.fulfill({ json: user });
    if (path.includes('/auth/v1/')) {
      return route.fulfill({ json: { access_token: token, refresh_token: 'qa-refresh', token_type: 'bearer', expires_in: 86400, user } });
    }
    return route.fulfill({ json: [] });
  });
  await page.route('**/api/**', route => {
    const media = new URL(route.request().url()).pathname === '/api/media';
    return route.fulfill({ json: media ? { tracks: [], introUrl: null } : { available: false, ok: true, games: [] } });
  });
  await page.addInitScript(() => {
    localStorage.setItem('ball-knower-team-setup-v2', 'complete');
    localStorage.setItem('ball-knower-intro-completed-v1', '2');
    localStorage.setItem('ball-knower-favorite-team', 'Philadelphia Eagles');
    localStorage.setItem('ball-knower-intro-sound-v1', 'off');
    localStorage.setItem('bk-guide-franchise-command-v1', 'seen');
  });

  const fantasyKey = 'ballknower_solo_fantasy_v2';
  const seasonKey = fantasyKey + ':season';
  const capKey = 'ballknower_solo_run_v2';
  const read = key => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  const button = name => page.getByRole('button', { name, exact: typeof name === 'string' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const out = 'artifacts/solo-draft-cap';
  await mkdir(out, {recursive:true});
  async function shot(name) {
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ' overflows');
    await page.screenshot({path:`${out}/${name}-${width}.png`});
  }
  async function open(mode) {
    await page.goto(base, {waitUntil: 'domcontentloaded'});
    await page.locator('.bk-home-stadium').waitFor();
    if (width >= 600) {
      await button('Explore Ball Knower').click();
      await page.getByRole('dialog', {name:'Explore Ball Knower'}).getByRole('button', {name:/^Solo careers/}).click();
    } else {
      await button('Play Solo Mode').click();
    }
    await page.locator('.bk-mode-card').filter({hasText:mode}).click();
  }
  async function playSeason(key, mode) {
    const interactions = page.getByRole('region', {name:'Franchise interactions'});
    for (let week = 1; week <= 17; week++) {
      await interactions.locator('article button').first().click();
      await button(`SIMULATE WEEK ${week}`).click();
      await page.waitForFunction(({key,week}) => JSON.parse(localStorage.getItem(key))?.weeks.length === week, {key,week});
      if (week === 8) {
        await open(mode);
        await interactions.waitFor();
        assert.equal((await read(key)).weeks.length, 8);
      }
    }
    await button(/SELECTION SUNDAY/).click();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key))?.stage !== 'regular', key);
    await finishPlayoffs(key);
  }
  async function checkPlayoffEntry(key, mode, result) {
    if (result.playoffs.length) return;
    // The ordinary run may miss the postseason. Seed a qualifying record in the isolated save.
    const qualifier = {
      ...result,
      stage: 'regular',
      playoffField: [],
      playoffs: [],
      weeks: result.weeks.map(week => ({...week, won:true})),
    };
    await page.evaluate(({key,qualifier}) => localStorage.setItem(key, JSON.stringify(qualifier)), {key,qualifier});
    await open(mode);
    await button(/SELECTION SUNDAY/).click();
    const art = page.locator('[data-art-kind="soloPlayoffs"] img');
    await art.scrollIntoViewIfNeeded();
    await art.evaluate(image => image.decode());
    await shot(`${mode.toLowerCase().replaceAll(' ', '-')}-playoffs`);
    await finishPlayoffs(key);
    assert((await read(key)).playoffs.length > 0);
  }
  async function finishPlayoffs(key) {
    while ((await read(key)).stage === 'playoffs') {
      const previous = (await read(key)).playoffs.length;
      await button(/^PLAY (WILD CARD|DIVISIONAL|CONFERENCE CHAMPIONSHIP|LEGACY BOWL)$/).click();
      await page.waitForFunction(({key,previous}) => JSON.parse(localStorage.getItem(key)).playoffs.length > previous, {key,previous});
    }
  }
  if (process.env.BK_QA_MODE !== 'cap') {
    await open('FANTASY DRAFT');
    await page.getByPlaceholder('Lehigh Valley Football League').fill('Night Draft League');
    await page.getByPlaceholder('Iron').fill('Steel City');
    await page.getByPlaceholder('Allentown, PA').fill('Allentown');
    await button('Create League & Start Draft').click();
    const progress = page.getByRole('region', {name:'Draft progress'});
    await progress.getByText('0/53 drafted', {exact:true}).waitFor();
    await progress.getByRole('button', {name:/^QB \+/}).click();
    await button(/^Draft .+, QB,/).first().click();
    await progress.getByText('1/53 drafted', {exact:true}).waitFor();
    await page.getByRole('textbox', {name:'Search fantasy draft players'}).fill('unmatched-prospect');
    await page.getByText('No eligible players match these filters.').waitFor();
    await shot('fantasy-draft');
    await button('AUTO PICK').click();
    for (let picks = 2; picks < 53; picks++) {
      await progress.getByText(`${picks}/53 drafted`, {exact:true}).waitFor();
      if (picks === 26) {
        const before = await read(fantasyKey);
        await open('FANTASY DRAFT');
        await progress.getByText('26/53 drafted', {exact:true}).waitFor();
        assert.deepEqual(await read(fantasyKey), before);
      }
      await button('AUTO PICK').click();
    }
    await page.getByRole('heading', {name:'DRAFT COMPLETE'}).waitFor();
    const drafted = await read(fantasyKey);
    assert.equal(drafted.draft.picks.length, 32 * 53);
    assert.equal(new Set(drafted.draft.draftedIds).size, 32 * 53);
    assert(Object.values(drafted.draft.rosters).every(roster => roster.length === 53));
    await shot('fantasy-draft-complete');
    await button('START SEASON').click();
    await playSeason(seasonKey, 'FANTASY DRAFT');
    const result = await read(seasonKey);
    assert.equal(result.stage, 'finished');
    await button('ENTER OFFSEASON DRAFT').click();
    for (let round = 1; round <= 7; round++) {
      await page.getByText(new RegExp(`^Round ${round}, Pick`)).waitFor();
      await page.getByRole('heading', {name:"YOU'RE ON THE CLOCK"}).locator('..').getByRole('button').first().click();
    }
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key))?.year === 2027, seasonKey);
    const rolled = await read(seasonKey);
    assert.equal(rolled.roster.length, 53);
    assert(rolled.roster.some(player => player.id.startsWith('franchise-rookie-2027-')));
    assert.equal(rolled.completedSeasons.length, 1);
    assert.equal(rolled.completedSeasons[0].year, 2026);
    assert.equal(rolled.completedSeasons[0].wins, result.weeks.filter(week => week.won).length);
    assert.equal(rolled.completedSeasons[0].leaders.length, 3);
    await open('FANTASY DRAFT');
    await button('SIMULATE WEEK 1').or(button('RESPOND TO TEAM FIRST')).waitFor();
    const reopened = await read(seasonKey);
    assert.equal(reopened.year, 2027);
    assert.deepEqual(reopened.roster.map(player => player.id), rolled.roster.map(player => player.id));
    assert.deepEqual(reopened.completedSeasons, rolled.completedSeasons);
    await page.getByText('Season history', {exact:true}).click();
    await page.getByText(new RegExp(`^2026 · ${rolled.completedSeasons[0].wins}–`)).waitFor();
    await page.getByRole('button', {name:'Back to Solo Mode choices',exact:true}).click();
    await page.locator('.bk-mode-card').filter({hasText:'FANTASY DRAFT'}).click();
    await button('SIMULATE WEEK 1').or(button('RESPOND TO TEAM FIRST')).waitFor();
    assert.deepEqual((await read(seasonKey)).roster.map(player => player.id), rolled.roster.map(player => player.id));
    await checkPlayoffEntry(seasonKey, 'FANTASY DRAFT', result);
    page.once('dialog', dialog => dialog.dismiss());
    await button('NEW LEAGUE').click();
    assert.deepEqual(await read(fantasyKey), {...drafted, seasonStarted:true});
    console.log('PASS Fantasy Draft: 53 rounds, 32 rosters, draft reload, 17 games, offseason and 2027 reload.');
  }
  if (process.env.BK_QA_MODE !== 'fantasy') {
    await open('CAP CHALLENGE');
    await page.getByRole('heading', {name:'BUILD YOUR ROSTER'}).waitFor();
    assert.equal(await page.getByText('A STAR WANTS AN EXPENSIVE EXTENSION', {exact:true}).count(), 0);
    await shot('cap-entry');
    assert(await button('START SEASON').isDisabled());
    await page.getByText('DRAFT SETTINGS', {exact:true}).click();
    await page.getByLabel('DIFFICULTY').selectOption('rookie');
    await button(/^(SMART )?AUTO-DRAFT$/).click();
    await page.getByText(/Smart starting roster built/).waitFor();
    const starting = await read(capKey);
    assert.equal(starting.roster.length, 20);
    assert.deepEqual(validateRosterShape(starting.roster), []);
    const spent = starting.roster.reduce((total, player) => total + player.salary, 0);
    assert(spent <= DEFAULT_SALARY_CAP + .000001);
    const remaining = DEFAULT_SALARY_CAP - spent;
    const draftedIds = new Set(starting.roster.map(player => player.id));
    const search = page.getByPlaceholder('Search players...');
    async function add(player) {
      await search.fill(player.name);
      await button('Add ' + player.name).first().click();
    }
    const cheap = SOLO_PLAYERS_DATABASE.filter(player => !draftedIds.has(player.id)).sort((a,b) => a.salary-b.salary);
    const bench = cheap.find(player => player.salary <= remaining);
    assert(bench, 'Auto-drafted roster can afford an optional backup');
    await add(bench);
    const secondBench = cheap.find(player => player.id !== bench.id && player.salary <= remaining - bench.salary);
    await add(secondBench);
    const thirdBench = cheap.find(player => ![bench.id, secondBench.id].includes(player.id) && player.salary <= remaining - bench.salary - secondBench.salary);
    await add(thirdBench);
    await page.getByRole('status').filter({hasText:'Your two bench/FLEX spots are full.'}).waitFor();
    assert.equal((await read(capKey)).bench.length, 2);
    await button(`Remove ${secondBench.name} from bench`).click();
    const starter = starting.roster.find(player => player.salary >= bench.salary);
    await button(`Remove ${starter.name} from starting roster`).click();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key))?.roster.length === 19, capKey);
    const partial = await read(capKey);
    await open('CAP CHALLENGE');
    await page.getByRole('status').filter({hasText:'Restored your last Solo Mode run.'}).waitFor();
    assert.deepEqual((await read(capKey)).roster.map(p => p.id), partial.roster.map(p => p.id));
    assert.equal((await read(capKey)).bench[0].id, bench.id);
    assert(await button('START SEASON').isDisabled());
    await button(`Remove ${bench.name} from bench`).click();
    await add(starter);
    await button('START SEASON').click();
    await playSeason(capKey, 'CAP CHALLENGE');
    const result = await read(capKey);
    assert.equal(result.stage, 'finished');
    const careerBefore = await read('ballknower_solo_career_v1');
    await open('CAP CHALLENGE');
    await page.getByRole('heading', {name:/^(RUN COMPLETE|LEGACY BOWL CHAMPION)$/}).waitFor();
    assert.equal((await read(capKey)).message, result.message);
    assert.deepEqual(await read('ballknower_solo_career_v1'), careerBefore);
    await shot('cap-result');
    page.once('dialog', dialog => dialog.dismiss());
    await button('Start a new Solo run').click();
    assert.equal((await read(capKey)).stage, 'finished');
    page.once('dialog', dialog => dialog.accept());
    await button('Start a new Solo run').click();
    await page.getByRole('heading', {name:'BUILD YOUR ROSTER'}).waitFor();
    assert.equal(await read(capKey), null);
    await checkPlayoffEntry(capKey, 'CAP CHALLENGE', result);
    // The current player pool stays below the ceiling even with a legal premium roster.
    // Exercise cap rejection with an older accepted budget, which may be near the ceiling.
    const legacy = {
      ...starting,
      independentSourceVersion: undefined,
      roster: starting.roster.map((player, index) => index === 0
        ? {...player, salary: Number((player.salary + remaining - 1).toFixed(2))}
        : player),
    };
    await page.evaluate(({key,legacy}) => localStorage.setItem(key, JSON.stringify(legacy)), {key:capKey,legacy});
    await open('CAP CHALLENGE');
    await page.getByRole('status').filter({hasText:'Restored your last Solo Mode run.'}).waitFor();
    const expensive = SOLO_PLAYERS_DATABASE.find(player => !draftedIds.has(player.id) && player.salary > 1);
    await add(expensive);
    await page.getByRole('status').filter({hasText:'That player puts you over the cap.'}).waitFor();
    assert.deepEqual((await read(capKey)).bench, []);
    console.log(`PASS Cap Challenge: cap rejection, legal 20, partial roster + bench reload, 17 games, result reload, reset. Record ${result.weeks.filter(w=>w.won).length}-${result.weeks.filter(w=>!w.won).length}.`);
  }
  assert.deepEqual(errors, []);
} catch (error) {
  await page.screenshot({path:`artifacts/solo-draft-cap/failure-${width}.png`}).catch(() => {});
  throw error;
} finally {
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
