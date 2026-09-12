import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {SOLO_PLAYERS_DATABASE,SOLO_TEAM_THEMES} from '../soloUniverse';
import {appearanceKey,appearanceSeed,defaultAppearance,FACE_COUNT,normalizeAppearance,playerAttributes,readAppearance,saveAppearance,uniformFor} from '../solo/appearance';

const player=SOLO_PLAYERS_DATABASE.find(p=>p.position==='WR')!;
const base=defaultAppearance(player);
for(const team of SOLO_TEAM_THEMES){
 const traded={...player,team:team.abbr,teamName:team.name};
 assert.equal(defaultAppearance(traded).face,base.face,'Trading changes a kit, not a face');
 assert.equal(uniformFor(traded).name,team.name);
 assert.notEqual(uniformFor(traded,'home').jersey,uniformFor(traded,'away').jersey);
}
assert.equal(defaultAppearance({...player,name:'Renamed player',jerseyNumber:0}).number,0);
assert.equal(defaultAppearance({...player,name:'Renamed player'}).face,base.face);
assert.equal(appearanceSeed(player.id),appearanceSeed(player.id));
assert.notEqual(appearanceSeed('franchise-rookie-2027-1'),appearanceSeed('franchise-rookie-2028-1'));
assert.equal(normalizeAppearance(player,{version:1,face:-1,build:'invalid',number:NaN}).face,base.face);
assert.equal(normalizeAppearance(player,{version:1,face:FACE_COUNT,number:1000}).number,base.number);
assert.deepEqual(normalizeAppearance(player,{version:2,face:1}),base);
assert.deepEqual(readAppearance(player,{getItem:()=>'{bad',setItem:()=>{},removeItem:()=>{}}),base);
const data=new Map<string,string>();
const store={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}};
const customized={...base,face:(base.face+1)%FACE_COUNT,number:0,build:'power' as const};
assert.ok(saveAppearance(player,customized,store));
assert.deepEqual(readAppearance(player,store),customized);
const before=store.getItem(appearanceKey(player.id));
assert.equal(saveAppearance(player,base,{...store,setItem:()=>{throw new Error('Quota exceeded');}}),false);
assert.equal(store.getItem(appearanceKey(player.id)),before,'Failed save must retain prior data');
assert.equal(uniformFor({...player,team:'FA',teamName:undefined}).name,'BK Training Kit');
assert.equal(uniformFor({...player,team:'PHI',teamName:undefined}).abbr,'BK','Never import real NFL artwork into Solo');
assert.deepEqual(playerAttributes({...player,speed:undefined,strength:undefined,awareness:undefined,attributes:{athleticism:81,footballIQ:75}}).map(a=>a.value),[81,75]);
for(const item of SOLO_PLAYERS_DATABASE){const look=defaultAppearance(item);assert.ok(look.face>=0&&look.face<FACE_COUNT);assert.ok(look.number>=0&&look.number<=99);}
const manifest=JSON.parse(readFileSync('public/solo-characters/v1/manifest.json','utf8'));
assert.equal(manifest.faces,FACE_COUNT);
let bytes=0;
for(const name of ['faces.webp','body.webp','regions.webp']){const actual=statSync(`public/solo-characters/v1/${name}`).size;assert.equal(actual,manifest.files[name].bytes);bytes+=actual;}
assert.ok(bytes<80_000,`Shared artwork exceeds 80 KB: ${bytes}`);
for(const file of ['solo/SoloPresentation.tsx','solo/SoloPlayerProfile.tsx','solo/appearance.ts','solo/characterRenderer.ts']){
 const source=readFileSync(file,'utf8');assert.ok(!/gemini|api\/my-player-art|licensedPlayerPortrait|three\/|WebGLRenderer|setInterval\(/.test(source),`${file} must not add generation calls, real photos or continuous rendering`);
}
const css=readFileSync('solo/soloPresentation.css','utf8');assert.ok(css.includes('100dvh')&&css.includes('safe-area-inset-bottom')&&css.includes('prefers-reduced-motion'));
console.log(JSON.stringify({playersChecked:SOLO_PLAYERS_DATABASE.length,teamsChecked:SOLO_TEAM_THEMES.length,prototypeFacePresets:FACE_COUNT,sharedArtBytes:bytes,identityAndFailureCases:'passed',physicalIphoneVerified:false,visualFidelityApproved:false},null,2));
