import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { assertAppNavigation, navigateFromExplore } from './assert-app-navigation.mjs';

const origin = 'http://127.0.0.1:4187';
const artifacts = 'artifacts/store';
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4187', '--strictPort'], { stdio: 'inherit' });
let browser;

try {
  let ready = false;
  for (let attempt = 0; attempt < 100 && !ready; attempt++) {
    try { ready = (await fetch(origin)).ok; } catch { /* Vite is starting. */ }
    if (!ready) await new Promise(resolve => setTimeout(resolve, 150));
  }
  assert.ok(ready, 'Build the app before running the Store browser check');
  await mkdir(artifacts, { recursive: true });
  for (const width of [320, 390, 1280]) {
    browser = await chromium.launch({
      executablePath: process.env.BROWSER_PATH || undefined,
      args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
    });
    const mobile = width < 768;
    const context = await browser.newContext({
      viewport: { width, height: 844 }, isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block',
      reducedMotion: 'reduce', deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && /WebGL|THREE|shader/i.test(message.text())) errors.push(message.text());
    });
    await page.route('**/*.supabase.co/**', route => route.abort());
    await page.route('**/api/**', route => route.fulfill({ json: { available: false, tracks: [] } }));
    await page.addInitScript((width) => {
      localStorage.setItem('ball-knower-team-setup-v2', 'complete');
      localStorage.setItem('ball-knower-intro-completed-v1', '2');
      localStorage.setItem('bk-guide-the-gauntlet-v4', 'seen');
      if (width !== 320 && !localStorage.getItem('ballknower_solo_my_player_v2')) {
        localStorage.setItem('ballknower_solo_my_player_v2', JSON.stringify({
          version: 1, stage: 'combine', name: 'Store Test Athlete', position: 'WR',
          number: 21, combineId: 'store-check-athlete', overall: 68,
        }));
      }
    }, width);
    await page.goto(origin);
    const nav = page.getByRole('navigation', { name: mobile ? 'Primary navigation' : 'Desktop primary navigation', exact: true });
    const storeTab = nav.getByRole('button', { name: 'Store', exact: true });
    await storeTab.click();
    const store = page.getByRole('region', { name: 'Store', exact: true });
    await store.waitFor();
    assert.equal(await storeTab.getAttribute('aria-current'), 'page');
    await assertAppNavigation(page, { mobile });
    for (const button of await nav.getByRole('button').all()) {
      const box = await button.boundingBox();
      assert.ok(box && box.width >= 44 && box.height >= 44, 'Primary tab has a usable touch target');
    }
    const hero = store.locator('.bk-store-hero-art');
    await hero.evaluate(image => image.decode());
    assert.ok(await hero.evaluate(image => image.naturalWidth > 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: artifacts + '/featured-' + width + '.png' });

    assert.equal(await store.locator('.bk-store-product').count(), 5, 'Store opens with YoungBoy and Frostbite among featured cards');
    await store.getByRole('button', { name: /Chrome Grip Gloves/ }).getByText('$0.99', { exact: true }).waitFor();
    const landingCategories = store.getByRole('group', { name: 'Shop categories', exact: true });
    await landingCategories.getByRole('button', { name: 'Tunnel Fits', exact: true }).click();
    assert.equal(await store.locator('.bk-store-product').count(), 5, 'Tunnel Fits includes YoungBoy and Frostbite');
    await landingCategories.getByRole('button', { name: 'All', exact: true }).click();


    {
      const goldCard=store.locator('[data-store-product="gold-standard"]');
      assert.equal(await goldCard.locator('.bk-store-gold-poster img').count(),1,'Gold Standard card has full portrait cover');
      assert.ok((await goldCard.locator('img').getAttribute('src')).includes('gold_standard_outfit_pack.png'),'Updated Gold Standard cover is on Store card');
      await goldCard.click();
      const gold=page.getByRole('dialog',{name:'Gold Standard',exact:true});
      await gold.getByRole('heading',{name:'Gold Standard',exact:true}).waitFor();
      const tabs=gold.getByRole('group',{name:'Product view'});
      assert.equal(await tabs.getByRole('button').count(),3,'Gold Standard has exactly three views');
      const posterTab=tabs.getByRole('button',{name:'Full poster'});
      const realTab=tabs.getByRole('button',{name:'Realistic view'});
      const modelTab=tabs.getByRole('button',{name:'3D preview'});
      assert.equal(await posterTab.getAttribute('aria-pressed'),'true');
      assert.ok((await gold.locator('.bkf-drop-hero img').getAttribute('src')).includes('gold_standard_outfit_pack.png'),'Gold Standard opens on full poster');
      await realTab.click();
      assert.ok((await gold.locator('.bkf-drop-hero img').getAttribute('src')).includes('golden_bk_tracksuit_athlete.png'),'Realistic full-body view is the second tab');
      await modelTab.click();
      const goldLive=gold.locator('[data-athlete-live-preview]');
      const goldCanvas=goldLive.locator('canvas[data-showroom-model="gold-standard-athlete"]');
      await goldCanvas.waitFor({timeout:30000});
      await gold.locator('[data-athlete-live-preview][data-render-state="ready"]').waitFor();
      const pixelRatio = await goldCanvas.evaluate(canvas => {
        const rect = canvas.getBoundingClientRect();
        return rect.width ? canvas.width / rect.width : Infinity;
      });
      assert.ok(pixelRatio <= (mobile ? 1.12 : 1.6), 'Gold Standard showroom limits GPU framebuffer resolution');
      assert.equal(await gold.getByText('Standard showcase character · Not your saved player').count(),1);
      assert.equal(await gold.getByText('My Player',{exact:true}).count(),0);
      assert.equal(await goldLive.getByRole('group',{name:'Outfit detail views'}).getByRole('button').count(),5);
      await goldLive.getByRole('button',{name:'Rotate right'}).click();
      await gold.getByText('$2.99',{exact:true}).waitFor();
      await gold.getByRole('button',{name:'Close product'}).click();
      await gold.waitFor({state:'hidden'});
    }

    const readSave = () => page.evaluate(() => ({
      athlete: localStorage.getItem('ballknower_solo_my_player_v2'),
      outfit: localStorage.getItem('ballknower_player_wardrobe_v1'),
    }));
    const before = await readSave();
    if (width === 390) {
      await store.getByRole('button', { name: 'Explore Drop', exact: true }).click();
      const product = page.getByRole('dialog', { name: 'Blackout Gear Kit', exact: true });
      await product.getByRole('button', { name: 'Try on', exact: true }).click();
      await product.getByText('Store Test Athlete', { exact: true }).waitFor();
      const frame = product.frameLocator('iframe[title="Game gear 3D preview"]');
      await frame.locator('canvas[data-uniform=blackout]').waitFor();
      await frame.locator('#status').waitFor({ state: 'hidden' });
      await product.getByRole('slider', { name: 'Rotate player', exact: true }).press('ArrowRight');
      await page.screenshot({ path: artifacts + '/try-on-' + width + '.png' });
      await product.getByRole('button', { name: 'Close product', exact: true }).click();
      await product.waitFor({ state: 'hidden' });
      assert.deepEqual(await readSave(), before, 'Try On must never save an outfit or alter the career');

      // BKF YoungBoy now has its own premium collection page instead of the old generic card modal.
      await store.locator('[data-store-product="bkf-youngboy"]').click();
      const youngBoy=page.getByRole('dialog',{name:'BKF YoungBoy',exact:true});
      await youngBoy.getByRole('heading',{name:'BKF YoungBoy'}).waitFor();
      const card=store.locator('[data-store-product="bkf-youngboy"]');
      assert.equal(await card.locator('.bk-store-youngboy-poster img').count(),1,'YoungBoy Store card uses full portrait poster');
      const views=youngBoy.getByRole('group',{name:'Product view'});
      assert.equal(await views.getByRole('button').count(),3,'YoungBoy has exactly three views');
      const poster=views.getByRole('button',{name:'Full poster'});
      const realistic=views.getByRole('button',{name:'Realistic view'});
      const tryOn=views.getByRole('button',{name:'3D preview'});
      const hero=youngBoy.locator('.bkf-drop-hero');
      assert.equal(await poster.getAttribute('aria-pressed'),'true','YoungBoy opens full poster by default');
      assert.equal(await hero.getAttribute('data-bkf-photo'),'poster');
      assert.equal(await youngBoy.locator('.bkf-drop-includes li').count(),6);
      assert.equal(await youngBoy.getByText('Coming Soon',{exact:true}).count(),1);
      const cover=hero.locator('img');
      await cover.evaluate(img=>img.decode());
      assert.ok(await cover.evaluate(img=>img.naturalWidth>100),'Approved YoungBoy full poster loads');
      await realistic.click();
      assert.equal(await realistic.getAttribute('aria-pressed'),'true');
      assert.ok((await hero.locator('img').getAttribute('src')).includes('Xh-J82kvc_xaAQT6S_pUO_USEo0H0r.png'),'YoungBoy original photoreal image is used');
      await tryOn.click();
      await youngBoy.locator('[data-bkf-rig-preview="youngboy"] canvas').waitFor();
      const rigPreview=youngBoy.locator('[data-bkf-rig-preview="youngboy"]');
      assert.equal(await rigPreview.getAttribute('data-bkf-pose'),'a-pose');
      assert.equal(await rigPreview.getByRole('group',{name:'Select stance'}).count(),0);
      assert.equal(await rigPreview.getByRole('button',{name:/Signature crouch|Original A-pose/}).count(),0);
      assert.equal(await rigPreview.getByRole('button',{name:'Rotate left'}).count(),1);
      assert.equal(await youngBoy.getByText('Standard showcase character · Not your saved player').count(),1);
      assert.equal(await youngBoy.getByText('My Player',{exact:true}).count(),0);
      await poster.click();
      assert.equal(await poster.getAttribute('aria-pressed'),'true');
      await youngBoy.getByRole('button',{name:'Close product'}).click();
      await youngBoy.waitFor({state:'hidden'});
      assert.deepEqual(await readSave(),before,'Previewing YoungBoy never purchases or equips items');
      await store.locator('[data-store-product="frostbite"]').click();
      const frostbite = page.getByRole('dialog', { name: 'BKF Frostbite', exact: true });
      await frostbite.getByRole('heading', { name: 'BKF Frostbite', exact: true }).waitFor();
      assert.equal(await frostbite.getByText('Coming Soon', { exact: true }).count(), 1);


      const storePoster = store.locator('[data-store-product="frostbite"] .bk-store-frostbite-poster img');
      assert.ok((await storePoster.getAttribute('src')).includes('3CD98264-BD29-4D30-9FAE-8EE444BB6E92.jpeg'), 'Frostbite poster appears in main Store card');
      const productView = frostbite.getByRole('group', { name: 'Product view' });
      assert.equal(await productView.getByRole('button').count(), 3, 'Frostbite has exactly three views');
      assert.equal(await frostbite.getByText('My Player', { exact: true }).count(), 0, 'No misleading My Player tab');
      const fullPoster = productView.getByRole('button', { name: 'Full poster' });
      const realisticView = productView.getByRole('button', { name: 'Realistic view' });
      const frostbiteTryOn = productView.getByRole('button', { name: '3D preview' });
      const hero = frostbite.locator('.bkf-drop-hero');
      assert.equal(await fullPoster.getAttribute('aria-pressed'), 'true', 'Poster opens by default');
      assert.equal(await hero.getAttribute('data-bkf-photo'), 'poster');
      assert.ok((await hero.locator('img').getAttribute('src')).includes('3CD98264-BD29-4D30-9FAE-8EE444BB6E92.jpeg'), 'Full poster is initially displayed');
      await realisticView.click();
      assert.equal(await realisticView.getAttribute('aria-pressed'), 'true');
      assert.ok((await hero.locator('img').getAttribute('src')).includes('ByU6fl61.png'), 'Realistic view is second');
      await frostbiteTryOn.click();
      assert.equal(await frostbiteTryOn.getAttribute('aria-pressed'), 'true');
      assert.equal(await frostbite.getByText('Standard showcase character · Not your saved player').count(), 1, '3D view is clearly a showcase character');
      const frostbiteRig = frostbite.locator('[data-bkf-rig-preview="frostbite"]');
      await frostbiteRig.locator('canvas').waitFor();
      assert.equal(await frostbiteRig.getAttribute('data-bkf-pose'), 'a-pose');
      assert.equal(await frostbiteRig.getByRole('group', { name: 'Select stance' }).count(), 0);
      assert.equal(await frostbiteRig.getByRole('button', { name: 'Rotate right' }).count(), 1);
      await frostbite.getByRole('button', { name: 'Close product' }).click();
      await frostbite.waitFor({ state: 'hidden' });
      assert.deepEqual(await readSave(), before, 'Frostbite preview never changes a player or purchases an item');
    }

    await store.getByRole('button', { name: 'View All', exact: true }).click();
    const catalog = page.getByRole('region', { name: 'Shop the Store', exact: true });
    const categories = catalog.getByRole('group', { name: 'Shop categories', exact: true });
    for (const [label, price] of [['Profile Pack', '$1.99'], ['Founder’s Pack', '$7.99']]) {
      const card = catalog.getByRole('button', { name: new RegExp(label) });
      await card.click();
      const product = page.getByRole('dialog', { name: label, exact: true });
      await product.getByText(price, { exact: true }).waitFor();
      await product.getByText('Planned price', { exact: true }).waitFor();
      await page.keyboard.press('Escape');
      await product.waitFor({ state: 'hidden' });
      assert.ok(await card.evaluate(element => element === document.activeElement), 'Closing the product returns focus to its card');
    }

    const cards = catalog.locator('.bk-store-product');
    const counts = { All: 11, 'Game Gear': 3, 'Tunnel Fits': 5, Profile: 2, Celebrations: 1, Franchise: 1, Bundles: 8 };
    for (const [category, count] of Object.entries(counts)) {
      const filter = categories.getByRole('button', { name: category, exact: true });
      await filter.click();
      assert.equal(await filter.getAttribute('aria-pressed'), 'true');
      assert.equal(await cards.count(), count, category);
    }
    await categories.getByRole('button', { name: 'All', exact: true }).click();
    for (const card of await cards.all()) {
      await card.scrollIntoViewIfNeeded();
      await card.locator('img').evaluate(image => image.decode());
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: artifacts + '/catalog-' + width + '.png' });

    {
      await categories.getByRole('button', { name: 'Tunnel Fits', exact: true }).click();
      await catalog.getByRole('button', { name: /^Tunnel Fit Hoodie/ }).click();
      const tunnel = page.getByRole('region', { name: 'Tunnel Fit', exact: true });
      await tunnel.getByText('$2.99', { exact: true }).waitFor();
      await tunnel.getByText('Planned price', { exact: true }).waitFor();
      assert.equal(await tunnel.locator('canvas').count(), 0, 'Product photos do not load the 3D canvas');
      const photos = tunnel.getByRole('group', { name: 'Product photo gallery' });
      const mode = tunnel.getByRole('group', { name: 'Product view' });
      assert.equal(await mode.getByRole('button', { name: 'Product photos' }).getAttribute('aria-pressed'), 'true');
      await tunnel.locator('.bk-tunnel-gallery img').first().evaluate(image => image.decode());
      await page.screenshot({ path: artifacts + '/tunnel-photos-' + width + '.png' });
      const trainerPhoto = photos.getByRole('button', { name: 'Trainer detail' });
      await trainerPhoto.click();
      assert.equal(await trainerPhoto.getAttribute('aria-pressed'), 'true');
      const gallery = tunnel.locator('.bk-tunnel-gallery');
      await gallery.evaluate(element => element.scrollTo({ left: element.clientWidth, behavior: 'instant' }));
      const hoodiePhoto = photos.getByRole('button', { name: 'Hoodie detail' });
      await page.waitForFunction(() => document.querySelector('[aria-label="Hoodie detail"]')?.getAttribute('aria-pressed') === 'true');
      assert.equal(await hoodiePhoto.getAttribute('aria-pressed'), 'true', 'Horizontal gallery navigation follows the visible photo');
      const tryOn = tunnel.getByRole('button', { name: 'Try on in 3D', exact: true });
      const modelResponse = page.waitForResponse('**/store/tunnel-fit-athlete-v1.glb');
      await tryOn.click();
      const showroom = page.getByRole('dialog', { name: 'Tunnel Fit', exact: true });
      await showroom.locator('[data-athlete-live-preview][data-render-state="ready"]').waitFor();
      assert.ok((await modelResponse).ok(), 'The full athlete model must load from the Store asset path');
      await showroom.getByText('$2.99', { exact: true }).waitFor();
      assert.equal(await showroom.getByRole('button', { name: '3D try-on' }).getAttribute('aria-pressed'), 'true');
      const preview = showroom.locator('.bk-athlete-3d-preview');
      assert.ok(await preview.evaluate(element => {
        const stage = element.querySelector('.bk-athlete-3d-stage').getBoundingClientRect();
        const canvas = element.querySelector('canvas').getBoundingClientRect();
        const controls = element.querySelector('.bk-showroom-orbit').getBoundingClientRect();
        const footer = element.closest('dialog').querySelector('.bk-tunnel-showroom-footer').getBoundingClientRect();
        return Math.abs(canvas.left - stage.left) < 2 && Math.abs(canvas.width - stage.width) < 2
          && Math.abs(canvas.height - stage.height) < 2 && controls.top >= stage.bottom - 1
          && stage.height > innerHeight * .54 && footer.bottom <= innerHeight;
      }), 'The showroom stage must dominate the viewport and leave room for the controls and price');
      await page.evaluate(async () => { const image = new Image(); image.src = '/store/tunnel-showroom.webp'; await image.decode(); });
      await showroom.screenshot({ path: artifacts + '/tunnel-fit-' + width + '.png' });
      const detailViews = preview.getByRole('group', { name: 'Outfit detail views' });
      assert.equal(await detailViews.getByRole('button', { name: 'Full outfit' }).getAttribute('aria-pressed'), 'true');
      const canvas = preview.locator('canvas');
      assert.equal(await canvas.getAttribute('data-showroom-model'), 'tunnel-fit-athlete');
      const fullFit = await canvas.screenshot();
      let previousFrame = fullFit;
      for (const [label, view] of [['Face','head'], ['Top','hoodie'], ['Pants','sweats'], ['Trainers','trainers']]) {
        const button = detailViews.getByRole('button', { name: label, exact: true });
        await button.click();
        assert.equal(await button.getAttribute('aria-pressed'), 'true');
        assert.equal(await preview.getAttribute('data-view'), view);
        const frame = await canvas.screenshot({ path: artifacts + '/tunnel-' + view + '-' + width + '.png' });
        assert.notDeepEqual(frame, previousFrame, label + ' must reframe the model');
        previousFrame = frame;
      }
      await preview.getByRole('button', { name: 'Rotate right' }).click();
      assert.notDeepEqual(await canvas.screenshot(), previousFrame, 'Rotation must redraw the trainer detail view');
      await preview.getByRole('button', { name: 'Reset view' }).click();
      assert.equal(await preview.getAttribute('data-view'), 'body');
      assert.deepEqual(await canvas.screenshot(), fullFit, 'Reset restores the original view and angle');
      if (width === 390) {
        const box = await canvas.boundingBox();
        await page.mouse.move(box.x + box.width * .38, box.y + box.height * .5);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * .72, box.y + box.height * .5, { steps: 3 });
        await page.mouse.up();
        assert.notDeepEqual(await canvas.screenshot(), fullFit, 'Dragging the stage rotates the athlete');
        await preview.getByRole('button', { name: 'Reset view' }).click();
        for (let turn = 0; turn < 12; turn++) {
          await preview.getByRole('button', { name: 'Rotate right' }).click();
          if (turn === 5) assert.notDeepEqual(await canvas.screenshot(), fullFit, 'The full model renders from the back');
        }
        assert.deepEqual(await canvas.screenshot(), fullFit, 'The full model can rotate all the way around');
        assert.equal(await preview.getByRole('button', { name: 'Try my athlete' }).count(), 0, 'Outfit showrooms only show the detailed sample athlete');
      }
      await showroom.getByRole('button', { name: 'Product photos' }).click();
      await showroom.waitFor({ state: 'hidden' });
      assert.ok(await tryOn.evaluate(element => element === document.activeElement), 'Closing the showroom restores focus');
      assert.equal(await hoodiePhoto.getAttribute('aria-pressed'), 'true', 'Returning to photos restores the selected detail');
      if (width === 390) {
        await mode.getByRole('button', { name: '3D try-on', exact: true }).click();
        await showroom.getByRole('button', { name: 'Back to product' }).click();
        await showroom.waitFor({ state: 'hidden' });
      }
      await tunnel.getByRole('button', { name: 'Back to shop', exact: true }).click();
      assert.ok(await catalog.getByRole('button', { name: /^Tunnel Fit Hoodie/ }).evaluate(element => element === document.activeElement));
      assert.equal(await categories.getByRole('button', { name: 'Tunnel Fits', exact: true }).getAttribute('aria-pressed'), 'true');
      assert.deepEqual(await readSave(), before, 'Tunnel Fit preview must not save premium clothing');
    }

    await catalog.getByRole('button', { name: 'Back to Store', exact: true }).click();
    await store.getByRole('button', { name: 'Earn Free Gear Combine & Gauntlet rewards' }).click();
    const rewards = page.getByRole('region', { name: 'Earn Free Gear', exact: true });
    assert.equal(await rewards.getByRole('link', { name: 'Play Combine', exact: true }).getAttribute('href'), '/combine.html');
    assert.ok((await context.request.get(origin + '/combine.html')).ok());
    await rewards.getByRole('button', { name: 'Play Gauntlet', exact: true }).click();
    await page.getByRole('heading', { name: 'The Gauntlet', exact: true }).waitFor();
    await storeTab.click();
    const locker = page.getByRole('region', { name: 'Player clothing locker', exact: true });
    if (width === 390) {
      await page.evaluate(() => {
        localStorage.setItem('bk-combine-forty-v1', JSON.stringify([
          { context: 'standalone', playerId: 'store-check-athlete', name: 'Store Test Athlete', position: 'WR', splits: [1.6, 2.8, 4.6], date: Date.now() },
        ]));
        localStorage.setItem('ballknower_gauntlet_progress_v2:user-default-1', JSON.stringify({
          daily: { '2026-11-08': { score: 7, completed: true } },
        }));
      });
      await store.getByRole('button', { name: 'Earn Free Gear Combine & Gauntlet rewards' }).click();
      await rewards.getByRole('button', { name: 'Claim Combine Practice Top', exact: true }).click();
      await rewards.getByRole('status').filter({ hasText: 'Combine Practice Top added to My Locker' }).waitFor();
      await rewards.getByRole('button', { name: 'Claim Gauntlet Wristbands', exact: true }).click();
      await rewards.getByRole('status').filter({ hasText: 'Gauntlet Wristbands added to My Locker' }).waitFor();
      await rewards.getByRole('button', { name: 'Open My Locker', exact: true }).click();
      await locker.getByRole('button', { name: 'Try on Combine Practice Top', exact: true }).click();
      await locker.getByRole('button', { name: 'Equip free item', exact: true }).click();
      await locker.getByRole('status').filter({ hasText: 'Combine Practice Top equipped' }).waitFor();
      assert.equal(JSON.parse((await readSave()).outfit).top, 'top-combine-reward');
    } else {
      await store.getByRole('button', { name: 'My Locker', exact: true }).click();
    }
    await locker.getByRole('button', { name: 'Try on Bone Training Top', exact: true }).click();
    await locker.getByRole('button', { name: 'Equip free item', exact: true }).click();
    await locker.getByRole('status').filter({ hasText: 'Bone Training Top equipped' }).waitFor();
    assert.equal(JSON.parse((await readSave()).outfit).top, 'top-bone');
    await locker.getByRole('button', { name: 'Shop Gear', exact: true }).click();
    await catalog.waitFor();
    assert.equal(await categories.getByRole('button', { name: 'Game Gear', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await cards.count(), 3);

    if (width === 390) {
      await navigateFromExplore(page, 'Solo careers', 'solo');
      await page.getByRole('button', { name: 'Choose Career', exact: true }).click();
      await page.getByRole('region', { name: 'Choose your career', exact: true }).getByRole('button', { name: /^My Player/ }).click();
      await page.getByRole('tab', { name: 'My Player', exact: true }).click();
      await page.getByRole('region', { name: 'Athlete locker', exact: true }).getByRole('button', { name: 'Shop Gear', exact: true }).click();
      await catalog.waitFor();
      assert.equal(await categories.getByRole('button', { name: 'Game Gear', exact: true }).getAttribute('aria-pressed'), 'true');
    }
    assert.deepEqual(errors, []);
    await context.close();
    await browser.close();
    browser = undefined;
    console.log('PASS Store at ' + width + 'px: navigation, catalog, previews, rewards and Locker.');
  }
} finally {
  await browser?.close();
  server.kill();
}
