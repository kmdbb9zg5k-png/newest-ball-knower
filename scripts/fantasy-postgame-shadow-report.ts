import {readFile,writeFile} from 'node:fs/promises';
import {evaluatePostgameShadow,loadPostgameShadowSources,type ShadowSources} from '../server/bk/fantasy-postgame-shadow';

const args=process.argv.slice(2),value=(flag:string)=>args[args.indexOf(flag)+1];
const usage='Usage: node --import tsx scripts/fantasy-postgame-shadow-report.ts --fetch [--out report.json]\n   or: node --import tsx scripts/fantasy-postgame-shadow-report.ts --input saved-sources.json [--out report.json]';
if(!args.includes('--fetch')&&!args.includes('--input'))throw new Error(usage);
if(args.includes('--fetch')&&args.includes('--input'))throw new Error(usage);
const identities=JSON.parse(await readFile(new URL('../data/independent-football-inputs.json',import.meta.url),'utf8'));
const sources:ShadowSources=args.includes('--fetch')?await loadPostgameShadowSources():JSON.parse(await readFile(value('--input'),'utf8'));
const report=evaluatePostgameShadow(sources,identities);
if(args.includes('--out'))await writeFile(value('--out'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({mode:report.mode,scoringAvailable:report.scoringAvailable,writes:report.writes,live:report.live,generatedAt:report.generatedAt,sourceTiming:report.sourceTiming,publicationOrderVerified:report.publicationOrderVerified,summary:report.summary,issues:report.issues,unsupported:report.unsupported,...(args.includes('--out')?{reportFile:value('--out')}:{})},null,2));
