import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSoloImageLoader } from '../solo/imageLoader';
import { portraitAsset, CREATOR_PORTRAIT } from '../solo/portraitAsset';
import { CREATOR_EASTER_EGG_ID, defaultAppearance } from '../solo/appearance';
import { SOLO_PLAYERS_DATABASE, SOLO_TEAM_THEMES } from '../soloUniverse';

const created: FakeImage[] = [];
class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 96;
  naturalHeight = 120;
  decoding = '';
  src = '';
  removed = false;
  removeAttribute(name: string) { if (name === 'src') { this.src = ''; this.removed = true; } }
}
const factory = () => { const image = new FakeImage(); created.push(image); return image as unknown as HTMLImageElement; };
const load = createSoloImageLoader({ createImage: factory, timeoutMs: 1000 });
const first = load('/solo-characters/v1/faces.webp');
assert.equal(load('/solo-characters/v1/faces.webp'), first, 'Concurrent previews must share one request');
assert.equal(created.length, 1);
created[0].onload!();
assert.equal(await first, created[0]);
assert.equal(load('/solo-characters/v1/faces.webp'), first, 'Decoded artwork stays cached');
assert.equal(created[0].onload, null);
assert.equal(created[0].onerror, null);

const failure = load('/solo-characters/v1/body.webp');
const rejected = assert.rejects(failure, /could not be loaded/);
created[1].onerror!();
await rejected;
assert.equal(created[1].removed, true);
const retry = load('/solo-characters/v1/body.webp');
assert.notEqual(retry, failure, 'Retry must not reuse a rejected promise');
created[2].onload!();
await retry;

const empty = load('/solo-characters/v1/regions.webp');
const unusable = assert.rejects(empty, /no usable pixels/);
created[3].naturalWidth = 0;
created[3].onload!();
await unusable;
const timedLoader = createSoloImageLoader({ createImage: factory, timeoutMs: 5 });
await assert.rejects(timedLoader(CREATOR_PORTRAIT), /timed out/);
assert.equal(created[4].removed, true, 'Timeout aborts the stalled image request');
assert.equal(created[4].onload, null);
const afterTimeout = timedLoader(CREATOR_PORTRAIT);
created[5].onload!();
await afterTimeout;

let assignments = 0;
for (const player of SOLO_PLAYERS_DATABASE) {
  const look = defaultAppearance(player);
  const source = portraitAsset(player, look.face);
  assert.equal(source.single, player.id === CREATOR_EASTER_EGG_ID);
  assert.ok(source.src.startsWith('/solo-characters/'), 'Solo cannot borrow live fantasy headshots');
  for (const team of SOLO_TEAM_THEMES) {
    assert.deepEqual(portraitAsset({ ...player, team: team.abbr }, look.face), source, 'Trades change uniforms, not photo identity');
    assignments++;
  }
}
const eli = SOLO_PLAYERS_DATABASE.find(player => player.id === CREATOR_EASTER_EGG_ID)!;
assert.equal(portraitAsset(eli, 5).src, CREATOR_PORTRAIT);
assert.equal(portraitAsset(eli, 5, true).single, false, 'Face-picker thumbnails must still show their explicit face');
assert.equal(portraitAsset(SOLO_PLAYERS_DATABASE[0], NaN).face, 0);
const css = readFileSync('solo/playerPhotos.css', 'utf8');
assert.match(css, /data-portrait-kind="single"/);
assert.match(css, /width:100%!important/);
assert.match(css, /height:100%!important/);
const renderer = readFileSync('solo/characterRenderer.ts', 'utf8');
assert.match(renderer, /faceSource=customFaceSrc\|\|portrait\.src/, 'Renderer must select the uploaded selfie or stable portrait source');
assert.match(renderer, /loadImage\(faceSource\)/, 'Only the selected face source should be loaded');
assert.ok(!renderer.includes('loadImage(ELI_FACE)'), 'Creator does not load both face libraries');
console.log(JSON.stringify({ players: SOLO_PLAYERS_DATABASE.length, teamAssignments: assignments, requestsDeduplicated: true, failedAndTimedOutRequestsRecover: true, creatorSinglePhotoSizing: 'CSS contract checked; browser test measures actual geometry', newArtworkGenerated: false, visualFidelityApproved: false }, null, 2));
