import fs from 'node:fs';
import path from 'node:path';
import {ASK_BK_MAX_IMAGES,validateAskBkImageFile} from '../askBkImages';
import {needsAskBkLiveSearch} from '../api/ask-bk';

const root=process.cwd();
const read=(file:string)=>fs.readFileSync(path.join(root,file),'utf8');
const app=read('App.tsx');
const nav=read('Navbar.tsx');
const hub=read('AskBkHub.tsx');
const api=read('api/ask-bk.ts');
const privacy=read('public/privacy.html');
const packageJson=JSON.parse(read('package.json'));
const failures:string[]=[];
const check=(condition:boolean,message:string)=>{if(!condition)failures.push(message)};

check(ASK_BK_MAX_IMAGES===5,'Ask BK must accept exactly five screenshots per question.');
check(app.includes("const AskBkHub=lazy("), 'Ask BK must remain lazy-loaded.');
check(app.includes("currentTab==='ask'&&<AskBkHub/>"), 'Ask BK route is missing.');
const triviaIndex=nav.indexOf("setCurrentTab('challenges')");
const askIndex=nav.indexOf("setCurrentTab('ask')",triviaIndex);
const profileIndex=nav.indexOf("setCurrentTab('locker')",askIndex);
check(triviaIndex>=0&&askIndex>triviaIndex&&profileIndex>askIndex,'Ask BK must appear between Trivia and Profile.');
check(/type="file" multiple/.test(hub),'Screenshot picker must allow multiple images.');
check(hub.includes('requestRef.current?.abort()'),'Leaving or clearing Ask BK must abort in-flight work.');
check(hub.includes('imagePreparationRef.current++'),'Clearing Ask BK must invalidate screenshot preparation.');
check(hub.includes('attachments:undefined'),'Full screenshot data must be discarded after an answer.');
check(!/localStorage|sessionStorage|indexedDB/i.test(hub),'Ask BK chat must not use persistent browser storage.');
check(api.includes("zeroDataRetention:true")&&api.includes("disallowPromptTraining:true"),'AI routing must request zero retention and no training.');
check(api.includes("FALLBACK_MODEL='openai/"),'Ask BK must retain a different-provider fallback engine.');
check(api.includes("gateway.tools.perplexitySearch"),'Date-sensitive sports questions need current search grounding.');
check(api.includes("ASK_BK_LIVE_SEARCH_ENABLED!=='false'"),'Ask BK needs an emergency live-search cost switch.');
check(api.includes('...(allowLiveSearch?{'),'Stable questions must not receive the paid search tool.');
check(api.includes('stopWhen:stepCountIs(2)'),'Current questions must be limited to one search round.');
check(api.includes("auth.auth.getUser(token)"),'Ask BK API must verify the Ball Knower session.');
check(privacy.includes('does not save Ask BK conversations or screenshots'),'Public privacy policy must document session-only behavior.');
check(packageJson.scripts?.['check:ask-bk']==='node --import tsx scripts/ask-bk-check.ts','Ask BK regression command is missing.');

validateAskBkImageFile({name:'lineup.PNG',type:'',size:42} as File);
try{validateAskBkImageFile({name:'lineup.pdf',type:'application/pdf',size:42} as File);failures.push('Non-image attachment validation did not reject a PDF.')}catch{}
try{validateAskBkImageFile({name:'huge.jpg',type:'image/jpeg',size:16*1024*1024} as File);failures.push('Oversize attachment validation did not reject a 16 MB image.')}catch{}
check(needsAskBkLiveSearch('Who should I start tonight?'),'Start/sit questions should be eligible for current search.');
check(needsAskBkLiveSearch('What is the latest injury news?'),'Latest injury questions should be eligible for current search.');
check(!needsAskBkLiveSearch('Explain PPR scoring.'),'Stable rules questions must not trigger current search.');
check(!needsAskBkLiveSearch('Break down these roster screenshots.'),'Screenshot analysis alone must not trigger current search.');

if(failures.length){console.error(`Ask BK checks failed:\n- ${failures.join('\n- ')}`);process.exit(1)}
console.log('Ask BK checks passed: navigation, five-image input, session-only privacy, secure AI routing, conditional live grounding, and input limits.');
