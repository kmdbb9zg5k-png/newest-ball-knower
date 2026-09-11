import { writeFile } from 'node:fs/promises';
import { PLAYERS_DATABASE } from '../players';
import { getLiveFantasyDraftGroup } from '../liveFantasyRules';
import { LICENSED_PLAYER_PORTRAITS, type LicensedPlayerPortrait } from '../licensedPlayerPortraits';

const limit = Math.max(1, Number(process.argv.find(value => value.startsWith('--limit='))?.split('=')[1]) || 300);
const concurrency = 8;
const headers = { 'User-Agent': 'BallKnower/1.0 (BallKnowerOfficial@gmail.com)' };
const safeLicense = /^(?:CC BY(?:-SA)?|CC0|Public domain|PD-US)/i;
const normalizeIdentity = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const decodeHtml = (value: string) => value
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ')
  .trim();

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const fetchJson = async (url: string) => {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json() as Promise<any>;
};

const wikipediaSummary = async (title: string) => {
  try {
    return await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
  } catch {
    return null;
  }
};

const findSummary = async (name: string, team: string) => {
  const variants = [name, name.replace(/\s+(?:Jr\.?|Sr\.?|II|III|IV)$/i, '')];
  for (const variant of [...new Set(variants)]) {
    const summary = await wikipediaSummary(variant);
    if (summary?.originalimage?.source && /football/i.test(`${summary.description || ''} ${summary.extract || ''}`)) return summary;
  }
  try {
    const search = await fetchJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${name} ${team} American football`)}&srlimit=5&format=json&origin=*`);
    for (const result of search?.query?.search || []) {
      const resultTitle = normalizeIdentity(String(result.title || ''));
      const playerName = normalizeIdentity(name);
      if (!resultTitle.includes(playerName) && !playerName.includes(resultTitle)) continue;
      const summary = await wikipediaSummary(result.title);
      if (summary?.originalimage?.source && /football/i.test(`${summary.description || ''} ${summary.extract || ''}`)) return summary;
    }
  } catch {}
  return null;
};

const portraitFor = async (name: string, team: string): Promise<LicensedPlayerPortrait | null> => {
  const summary = await findSummary(name, team);
  const source = String(summary?.originalimage?.source || '');
  if (!source.includes('upload.wikimedia.org/wikipedia/commons/')) return null;
  const fileName = decodeURIComponent(new URL(source).pathname.split('/').pop() || '').replace(/_/g, ' ');
  if (!fileName || !/\.(?:avif|gif|jpe?g|png|webp)$/i.test(fileName)) return null;
  try {
    const metadata = await fetchJson(`https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata&titles=${encodeURIComponent(`File:${fileName}`)}&format=json&origin=*`);
    const page = Object.values(metadata?.query?.pages || {})[0] as any;
    const details = page?.imageinfo?.[0]?.extmetadata || {};
    const license = decodeHtml(String(details.LicenseShortName?.value || ''));
    const creator = decodeHtml(String(details.Artist?.value || ''));
    const licenseUrl = String(details.LicenseUrl?.value || (license.toLowerCase().includes('public domain') ? 'https://creativecommons.org/publicdomain/mark/1.0/' : ''));
    const surname = name.replace(/\s+(?:Jr\.?|Sr\.?|II|III|IV)$/i, '').trim().split(/\s+/).at(-1) || '';
    const identityMetadata = [fileName, details.ObjectName?.value, details.ImageDescription?.value, details.Categories?.value]
      .map(value => decodeHtml(String(value || '')))
      .join(' ');
    if (
      !safeLicense.test(license)
      || !creator
      || !licenseUrl
      || (surname.length >= 4 && !normalizeIdentity(identityMetadata).includes(normalizeIdentity(surname)))
    ) return null;
    return {
      fileName,
      sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName).replace(/%20/g, '_').replace(/'/g, '%27')}`,
      creator: creator.slice(0, 180),
      license,
      licenseUrl,
    };
  } catch {
    return null;
  }
};

const candidates = PLAYERS_DATABASE
  .filter(player => getLiveFantasyDraftGroup(player) && player.position !== 'DST')
  .sort((first, second) => second.ovr - first.ovr || first.name.localeCompare(second.name))
  .filter((player, index, all) => all.findIndex(item => item.name === player.name) === index)
  .slice(0, limit);

const additions: Record<string, LicensedPlayerPortrait> = {};
let cursor = 0;
const worker = async () => {
  while (cursor < candidates.length) {
    const player = candidates[cursor++];
    if (LICENSED_PLAYER_PORTRAITS[player.name]) continue;
    const portrait = await portraitFor(player.name, player.team);
    if (portrait) additions[player.name] = portrait;
  }
};
await Promise.all(Array.from({ length: concurrency }, worker));

const portraits = Object.fromEntries(Object.entries({ ...LICENSED_PLAYER_PORTRAITS, ...additions }).sort(([first], [second]) => first.localeCompare(second)));
const registry = `export type LicensedPlayerPortrait = {\n  fileName: string;\n  sourceUrl: string;\n  creator: string;\n  license: string;\n  licenseUrl: string;\n};\n\nconst normalizePlayerName = (value: string) =>\n  value.toLowerCase().replace(/[^a-z0-9]/g, '');\n\nexport const LICENSED_PLAYER_PORTRAITS: Record<string, LicensedPlayerPortrait> = ${JSON.stringify(portraits, null, 2)};\n\nconst LICENSED_BY_NORMALIZED_NAME = new Map(\n  Object.entries(LICENSED_PLAYER_PORTRAITS).map(([name, portrait]) => [\n    normalizePlayerName(name),\n    portrait,\n  ]),\n);\n\nexport function getLicensedPlayerPortrait(\n  playerName: string,\n): LicensedPlayerPortrait | undefined {\n  return LICENSED_BY_NORMALIZED_NAME.get(normalizePlayerName(playerName));\n}\n\nexport function licensedPlayerPortraitUrl(\n  portrait: LicensedPlayerPortrait,\n  width = 160,\n): string {\n  const safeWidth = Math.max(64, Math.min(1024, Math.round(Number.isFinite(width) ? width : 160)));\n  return \`https://commons.wikimedia.org/wiki/Special:Redirect/file/\${encodeURIComponent(portrait.fileName)}?width=\${safeWidth}\`;\n}\n`;

const cards = Object.entries(portraits).map(([name, portrait]) => `<div class="card"><strong>${escapeHtml(name)}</strong><br>Creator: ${escapeHtml(portrait.creator)}<br>License: <a href="${escapeHtml(portrait.licenseUrl)}">${escapeHtml(portrait.license)}</a><br>Source: <a href="${escapeHtml(portrait.sourceUrl)}">Wikimedia Commons</a></div>`).join('\n');
const credits = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ball Knower Player Photo Credits</title><meta name="description" content="Licenses and attribution for reusable player photography shown in Ball Knower."><style>body{margin:0;background:#080a0d;color:#e5e7eb;font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:820px;margin:auto;padding:48px 20px 80px}h1,h2{color:#fff;line-height:1.15}h1{font-size:38px}a{color:#d4af37}.card{margin:18px 0;padding:18px;border:1px solid #27272a;border-radius:16px;background:#111318}.muted{color:#9ca3af}</style></head><body><main><h1>Player Photo Credits</h1><p class="muted">Ball Knower uses selected photographs from Wikimedia Commons only when the file page documents a license that permits reuse. The original creators retain their rights. Ball Knower does not claim ownership of these photographs.</p>\n${cards}\n<p>Photos may be resized and clipped to fit the interface. Any adapted photograph is offered under the applicable source license, including ShareAlike where required. Source pages document original files and earlier crops. These photo licenses do not license Ball Knower code or imply a player endorsement.</p><p class="muted">Players without an approved photograph are represented by an original Ball Knower initials badge rather than an unlicensed third-party image.</p><p><a href="/terms.html">Terms of Use</a> · <a href="/privacy.html">Privacy Policy</a> · <a href="/">Ball Knower</a></p></main></body></html>`;

await writeFile(new URL('../licensedPlayerPortraits.ts', import.meta.url), registry);
await writeFile(new URL('../public/player-photo-credits.html', import.meta.url), credits);
console.log(JSON.stringify({ candidates: candidates.length, existing: Object.keys(LICENSED_PLAYER_PORTRAITS).length, added: Object.keys(additions).length, total: Object.keys(portraits).length }, null, 2));
