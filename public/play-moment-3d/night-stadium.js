/** Original, static night-game scenery for the 3D field.
 * No gameplay state, animation timers, network requests or career storage.
 * One shared 1024 x 256 sign texture; existing instanced shapes do the rest.
 */
import {hex, mul, pose, rx, scale, segment, translate} from './renderer.js';

export const NIGHT_SIGN = 'bk-night-stadium-sign';
export const SIGN_WIDTH = 1024;
export const SIGN_HEIGHT = 256;

/** An upright, readable sign facing into the field from either end zone. */
export function signMatrix(z) {
  const far = z > 60;
  return mul(translate(0, 15, z), mul(
    rx(far ? Math.PI / 2 : -Math.PI / 2),
    scale(far ? -26 : 26, -1, far ? 6.5 : -6.5)
  ));
}

/** Pure geometry builder; safe to exercise without a browser or renderer. */
export function createNightStadiumParts() {
  const parts = [];
  const add = (id, shape, matrix, color, texture = '', unlit = false) => {
    parts.push({id, shape, matrix, color: hex(color), texture, unlit});
  };
  const box = (id, x, y, z, sx, sy, sz, color, unlit = false) =>
    add(id, 'cube', pose(x, y, z, sx, sy, sz), color, '', unlit);
  const rod = (id, a, b, radius, color) =>
    add(id, 'cylinder', segment(a, b, radius), color);

  for (const side of [-1, 1]) {
    // A press level and cantilevered canopy give the bowl a stadium silhouette.
    box(`press-${side}`, side * 49.3, 14.6, 60, 6.6, 4.6, 140, '#101e2a');
    box(`glass-${side}`, side * 45.94, 14.7, 60, .10, 3.3, 138, '#23404f');
    box(`canopy-${side}`, side * 50.8, 18.2, 60, 12, .38, 146, '#172633');
    box(`fascia-${side}`, side * 44.72, 18, 60, .2, .8, 146, '#293e4b');
    // Steady architectural light, not flashing bloom or full-screen effects.
    box(`ribbon-${side}`, side * 45.81, 12.95, 60, .12, .22, 140, '#c5aa68', true);
    box(`canopy-light-${side}`, side * 44.57, 17.63, 60, .12, .10, 142, '#a6bcc2', true);
    for (let z = -6, bay = 0; z <= 126; z += 12, bay++) {
      box(`mullion-${side}-${bay}`, side * 45.82, 14.7, z, .18, 3.5, .15, '#819091');
      // Lit suites are inset, not luminous blocks covering the whole facade.
      if (bay % 3 !== 1)
        box(`suite-${side}-${bay}`, side * 45.85, 14.45, z + 4.8, .13, 1.2, 3.6, '#a68c60', true);
      rod(`canopy-brace-${side}-${bay}`, [side * 55.8, 15.4, z], [side * 44.9, 17.7, z], .075, '#4a606b');
      rod(`canopy-support-${side}-${bay}`, [side * 55.8, 9.2, z], [side * 55.8, 18.2, z], .105, '#354c58');
      box(`roof-lamp-${side}-${bay}`, side * 44.8, 17.47, z + 4, .7, .12, 2.2, '#e4e6da', true);
    }
    // Equipment stays outside the sidelines and cannot cover the playable turf.
    for (const z of [42, 78]) {
      box(`case-${side}-${z}`, side * 29.4, .48, z, 1.3, .9, 2.4, '#263f4e');
      box(`case-lid-${side}-${z}`, side * 29.4, .97, z, 1.4, .1, 2.5, '#bdc9cb');
      box(`cooler-${side}-${z}`, side * 29.4, 1.35, z, .58, .68, .58, '#af7045');
      box(`cooler-lid-${side}-${z}`, side * 29.4, 1.73, z, .63, .1, .63, '#cdd3cc');
    }
  }

  for (const z of [-10, 130]) {
    const far = z > 60;
    const front = z + (far ? -.53 : .53);
    box(`screen-body-${z}`, 0, 15, z, 27.1, 7.4, 1, '#0b1520');
    add(`screen-${z}`, 'plane', signMatrix(front), '#ffffff', NIGHT_SIGN, true);
    box(`screen-top-${z}`, 0, 18.57, front, 27.1, .12, .12, '#ceb578', true);
    box(`screen-bottom-${z}`, 0, 11.45, front, 27.1, .12, .12, '#748e9f', true);
    for (const side of [-1, 1]) {
      rod(`screen-post-${side}-${z}`, [side * 10.5, 3, z], [side * 10.5, 11.3, z], .25, '#394d5a');
      box(`speaker-${side}-${z}`, side * 14.4, 13.6, z, .9, 3.4, .8, '#0c1620');
      for (let i = 0; i < 4; i++)
        box(`speaker-grille-${side}-${z}-${i}`, side * 14.4, 12.3 + i * .84, front, .65, .03, .10, '#42535e');
    }
    // Framed player entrances; no animated textures or moving cameras.
    const portal = far ? 123.6 : -3.6;
    box(`tunnel-${z}`, 0, 1.8, portal, 7.2, 3.6, .35, '#060d14');
    box(`tunnel-lintel-${z}`, 0, 3.7, portal, 8.1, .4, .8, '#293d49');
    for (const side of [-1, 1]) {
      box(`tunnel-pillar-${side}-${z}`, side * 3.9, 1.9, portal, .4, 3.8, .8, '#293d49');
      box(`tunnel-light-${side}-${z}`, side * 3.65, 1.9, portal + (far ? -.43 : .43), .09, 3.2, .07, '#b99b60', true);
    }
  }
  // Pads decorate the goal supports already present in the base stadium.
  for (const z of [3, 117]) {
    add(`goal-pad-${z}`, 'cylinder', pose(0, .9, z, .30, 1.8, .30), '#172c3b');
    add(`goal-band-${z}`, 'cylinder', pose(0, 1.56, z, .307, .12, .307), '#cbb173');
  }
  return parts;
}

/** Paint original branding once. Never display invented scores or a live feed. */
export function makeNightSign(doc = document) {
  const canvas = doc.createElement('canvas');
  canvas.width = SIGN_WIDTH;
  canvas.height = SIGN_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const background = ctx.createLinearGradient(0, 0, SIGN_WIDTH, SIGN_HEIGHT);
  background.addColorStop(0, '#29475b');
  background.addColorStop(.55, '#142736');
  background.addColorStop(1, '#0c1723');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, SIGN_WIDTH, SIGN_HEIGHT);

  ctx.strokeStyle = '#7791a535';
  ctx.lineWidth = 2;
  for (let x = 135; x < SIGN_WIDTH; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, SIGN_HEIGHT);
    ctx.lineTo(x + 190, 0);
    ctx.stroke();
  }
  ctx.fillStyle = '#10202f';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(268, 0);
  ctx.lineTo(198, SIGN_HEIGHT);
  ctx.lineTo(0, SIGN_HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#b99d63';
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, SIGN_WIDTH - 24, SIGN_HEIGHT - 24);
  ctx.beginPath();
  ctx.moveTo(267, 14);
  ctx.lineTo(203, SIGN_HEIGHT - 14);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'italic 900 108px Arial';
  ctx.fillStyle = '#e7c783';
  ctx.fillText('BK', 117, 134);
  ctx.font = 'italic 900 86px Arial';
  ctx.fillStyle = '#f2eddf';
  ctx.fillText('BALL KNOWER', 624, 134, 715);
  return canvas;
}

/** Install once; repeated scene draws only reuse the existing static parts. */
export function installNightStadium(renderer, add) {
  let hasSign = renderer.textures.has(NIGHT_SIGN);
  if (!hasSign) {
    const sign = makeNightSign();
    if (sign) {renderer.texture(NIGHT_SIGN, sign);hasSign = true;}
  }
  const parts = createNightStadiumParts();
  for (const p of parts) {
    // A failed optional canvas must not break the practice renderer.
    if (p.texture && !hasSign) continue;
    add(p.shape, p.matrix, p.color, p.texture, p.unlit);
  }
  return parts.length;
}
