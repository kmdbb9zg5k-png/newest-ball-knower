/** Build a deterministic review surface from the actual components after npm run build.
 * It uses test-only data and makes no account, league, or profile writes.
 */
import { build } from 'esbuild';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
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
  fantasyLeagueParityCloud: `export const fetchHomeWeeklyScores=async()=>[];`,
  FantasySettingsHub: `export const FantasySettingsHub=()=>null;`,
  LeagueManagementModal: `export const LeagueManagementModal=()=>null;`,
  HomeNewsTicker: `export const HomeNewsTicker=()=>null;`,
};
await mkdir(out, { recursive: true });
await build({
  entryPoints: [path.join(repo, 'scripts/fixtures/navigation-review.tsx')],
  outfile: path.join(out, 'fixture.js'), bundle: true, format: 'esm', platform: 'browser',
  loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'review-data-only', setup(builder) {
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
  const css = (await readdir(path.join(dist, 'assets'))).filter(name => /^(index|HomeDashboard|LockerHub|PlayHub)-.*\.css$/.test(name));
  if (!css.some(name => name.startsWith('index-'))) throw Error('Run npm run build first so the fixture uses the actual compiled app styles.');
  const links = css.sort((a,b) => Number(b.startsWith('index-'))-Number(a.startsWith('index-'))).map(name => `<link rel="stylesheet" href="/assets/${name}">`).join('\n');
  await writeFile(path.join(out, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Ball Knower navigation review</title>${links}<body><div id="root"></div><script type="module" src="/navigation-review/fixture.js"></script></body></html>`);
  console.log(`Review fixture built at ${out}. Serve dist, then run the browser check in CI.`);
}
