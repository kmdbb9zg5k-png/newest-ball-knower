/** Build a deterministic review surface from the actual components after npm run build.
 * It uses test-only data and makes no account, league, or profile writes.
 */
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repo = process.cwd();
const dist = path.resolve(process.env.BK_REVIEW_DIST || 'dist');
const out = path.join(dist, 'navigation-review');
const data = path.join(repo, 'scripts/fixtures/navigation-data.ts');
const dataImport = `import {fixtureLeagues,profile,user,scenario} from ${JSON.stringify(data)};`;
const mocks = {
  BallKnowerContext: `${dataImport} export const useBallKnower=()=>({currentUser:user,setCurrentUser:()=>{},activeLeague:fixtureLeagues()[0]||null,leagues:fixtureLeagues(),setActiveLeagueId:()=>{},isDemoMode:false,exitDemoMode:()=>{},showToast:()=>{}});`,
  SoundtrackContext: `export const useSoundtrack=()=>({isPlaying:false,isMuted:true,volume:.22,currentTrack:{title:'Ball Knower soundtrack',artist:'Ball Knower',name:'Ball Knower soundtrack'},currentTrackIndex:0,allTracks:[],toggleMute:()=>{},setVolume:()=>{},nextTrack:()=>{},prevTrack:()=>{},selectTrack:()=>{},play:()=>{},pause:()=>{},isIntroActive:false});`,
  supabase: `export const supabase=null,isCloudConfigured=false;export const ensureOnlineSession=async()=>null;export const signOutOnline=async()=>{};`,
  progressionCloud: `${dataImport} export const fetchProgressionProfile=async()=>{if(scenario()==='offline')throw Error('Offline fixture');return {profile,events:[],achievements:[]}};`,
  fantasySeasonCloud: `export const fetchSeasonOperations=async()=>({transactions:[],trades:[],claims:[],messages:[]});`,
  fantasyLeagueParityCloud: `export const fetchHomeWeeklyScores=async()=>[];export const subscribeToFantasyParity=()=>()=>{};`,
  FantasySettingsHub: `export const FantasySettingsHub=()=>null;`,
  LeagueManagementModal: `export const LeagueManagementModal=()=>null;`,
  HomeNewsTicker: `export const HomeNewsTicker=()=>null;`,
};
await mkdir(out, { recursive: true });
await build({
  entryPoints: [path.join(repo, 'scripts/fixtures/navigation-review.tsx')],
  outfile: path.join(out, 'fixture.js'), bundle: true, format: 'esm', platform: 'browser',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'review-data-only', setup(builder) {
    builder.onResolve({ filter: /^\// }, args => args.kind === 'url-token' ? { path: args.path, external: true } : undefined);
    builder.onResolve({ filter: /(?:^|\/)(BallKnowerContext|SoundtrackContext|supabase|progressionCloud|fantasySeasonCloud|fantasyLeagueParityCloud|FantasySettingsHub|LeagueManagementModal|HomeNewsTicker)$/ }, args => {
      const key = args.path.split('/').at(-1);
      return { path: key, namespace: 'review-mock' };
    });
    builder.onLoad({ filter: /.*/, namespace: 'review-mock' }, args => ({ contents: mocks[args.path], loader: 'ts', resolveDir: repo }));
  }}],
});
if (process.env.BK_NAV_FIXTURE_COMPILE_ONLY === '1') {
  console.log('Navigation fixture components compiled. Browser and layout checks were not run.');
} else {
  const entryHtml = await readFile(path.join(dist, 'index.html'), 'utf8');
  // Preserve exact entry styles, including external fonts with href before rel.
  // Component styles come from esbuild's real import graph rather than Vite chunk names:
  // homeLayout can be a shared chunk, and Profile needs its page-level composition too.
  const entryStyles = [...entryHtml.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi)].map(match => match[0]);
  if (!entryStyles.some(tag => /href=["']\/assets\//.test(tag))) throw Error('Run npm run build first so the fixture uses the actual compiled app styles.');
  const componentStyles = await readFile(path.join(out, 'fixture.css'), 'utf8');
  for (const selector of ['.bk-home-league-top', '.bk-home-league-cta', '.bk-mini-games-cover', '.bk-profile-hero', '.bk-primary-destinations']) {
    if (!componentStyles.includes(selector)) throw Error(`Review fixture is missing component styles: ${selector}`);
  }
  const links = [...entryStyles, '<link rel="stylesheet" href="/navigation-review/fixture.css">'].join('\n');
  await writeFile(path.join(out, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Ball Knower navigation review</title>${links}<body><div id="root"></div><script type="module" src="/navigation-review/fixture.js"></script></body></html>`);
  console.log(`Review fixture built at ${out}. Serve dist, then run the browser check in CI.`);
}
