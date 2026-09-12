import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {SOLO_PLAYERS_DATABASE,SOLO_TEAM_THEMES} from '../soloUniverse';
import {appearanceKey,appearanceSeed,appearanceSignature,CREATOR_EASTER_EGG_ID,defaultAppearance,EYE_BLACK_COUNT,FACE_COUNT,FACIAL_HAIR_COUNT,HAIR_COUNT,normalizeAppearance,playerAttributes,readAppearance,saveAppearance,uniformFor} from '../solo/appearance';

const player=SOLO_PLAYERS_DATABASE.find(p=>p.position==='WR'&&p.id!==CREATOR_EASTER_EGG_ID)!;
const base=defaultAppearance(player);
for(const team of SOLO_TEAM_THEMES){
 const traded={...player,team:team.abbr,teamName:team.name};
 assert.equal(defaultAppearance(traded).face,base.face,'Trading changes a kit, not a face');
 assert.equal(appearanceSignature(traded),appearanceSignature(player),'Trading cannot mutate player DNA');
 assert.equal(uniformFor(traded).name,team.name);
 assert.notEqual(uniformFor(traded,'home').jersey,uniformFor(traded,'away').jersey);
}
assert.equal(defaultAppearance({...player,name:'Renamed player',jerseyNumber:0}).number,0);
assert.equal(defaultAppearance({...player,name:'Renamed player'}).face,base.face);
assert.equal(appearanceSeed(player.id),appearanceSeed(player.id));
assert.notEqual(appearanceSeed('franchise-rookie-2027-1'),appearanceSeed('franchise-rookie-2028-1'));
const migrated=normalizeAppearance(player,{version:1,face:1,build:'power',number:0,sleeves:'both'});
assert.equal(migrated.version,2);assert.equal(migrated.face,1);assert.equal(migrated.build,'power');assert.equal(migrated.number,0);assert.equal(migrated.sleeves,'both');
assert.equal(normalizeAppearance(player,{version:1,face:-1,build:'invalid',number:NaN}).face,base.face);
assert.equal(normalizeAppearance(player,{version:1,face:FACE_COUNT,number:1000}).number,base.number);
assert.deepEqual(readAppearance(player,{getItem:()=>'{bad',setItem:()=>{},removeItem:()=>{}}),base);
const data=new Map<string,string>();
const store={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}};
const customized={...base,face:(base.face+1)%FACE_COUNT,hair:(base.hair+1)%HAIR_COUNT,facialHair:(base.facialHair+1)%FACIAL_HAIR_COUNT,eyeBlack:(base.eyeBlack+1)%EYE_BLACK_COUNT,number:0,build:'power' as const,gloves:'dark' as const,sleeves:'left' as const};
assert.ok(saveAppearance(player,customized,store));
assert.deepEqual(readAppearance(player,store),customized);
const before=store.getItem(appearanceKey(player.id));
assert.equal(saveAppearance(player,base,{...store,setItem:()=>{throw new Error('Quota exceeded');}}),false);
assert.equal(store.getItem(appearanceKey(player.id)),before,'Failed save must retain prior data');
assert.equal(uniformFor({...player,team:'FA',teamName:undefined}).name,'BK Training Kit');
assert.equal(uniformFor({...player,team:'PHI',teamName:undefined}).abbr,'BK','Never import real NFL artwork into Solo');
assert.deepEqual(playerAttributes({...player,speed:undefined,strength:undefined,awareness:undefined,attributes:{athleticism:81,footballIQ:75}}).map(a=>a.value),[81,75]);

const signatures=new Map<string,string[]>();
const teamSignatures=new Map<string,Set<string>>();
for(const item of SOLO_PLAYERS_DATABASE){
 const look=defaultAppearance(item);
 assert.ok(look.face>=0&&look.face<FACE_COUNT);assert.ok(look.hair>=0&&look.hair<HAIR_COUNT);assert.ok(look.facialHair>=0&&look.facialHair<FACIAL_HAIR_COUNT);assert.ok(look.eyeBlack>=0&&look.eyeBlack<EYE_BLACK_COUNT);assert.ok(look.number>=0&&look.number<=99);
 const signature=appearanceSignature(item);const list=signatures.get(signature)??[];list.push(item.id);signatures.set(signature,list);
 const teamSet=teamSignatures.get(item.team)??new Set<string>();teamSet.add(signature);teamSignatures.set(item.team,teamSet);
}
const uniqueRatio=signatures.size/SOLO_PLAYERS_DATABASE.length;
assert.ok(uniqueRatio>.78,`Exact appearance-DNA uniqueness too low: ${(uniqueRatio*100).toFixed(1)}%`);
for(const [team,set] of teamSignatures)assert.ok(set.size>=44,`${team} has too many exact visual duplicates: ${set.size}/53 unique`);
const worstCollision=Math.max(...Array.from(signatures.values(),players=>players.length));
assert.ok(worstCollision<=4,`One exact appearance combo is reused ${worstCollision} times`);

const eli=SOLO_PLAYERS_DATABASE.find(p=>p.id===CREATOR_EASTER_EGG_ID);
assert.ok(eli,'Creator Easter egg must remain in Solo database');
assert.equal(eli?.name,'Eli Rodriguez');assert.equal(eli?.position,'WR');assert.equal(eli?.ovr,85);assert.equal(eli?.experience,10);assert.equal(eli?.age,30);

const manifest=JSON.parse(readFileSync('public/solo-characters/v1/manifest.json','utf8'));
assert.equal(manifest.faces,FACE_COUNT);
let sharedBytes=0;
for(const name of ['faces.webp','body.webp','regions.webp']){const actual=statSync(`public/solo-characters/v1/${name}`).size;assert.equal(actual,manifest.files[name].bytes);sharedBytes+=actual;}
const creatorBytes=statSync('public/solo-characters/v1/creator/eli-face.webp').size;
assert.ok(sharedBytes<80_000,`Shared artwork exceeds 80 KB: ${sharedBytes}`);
assert.ok(sharedBytes+creatorBytes<100_000,`Solo visual payload exceeds 100 KB: ${sharedBytes+creatorBytes}`);
for(const file of ['solo/SoloPresentation.tsx','solo/SoloPlayerProfile.tsx','solo/appearance.ts','solo/characterRenderer.ts']){
 const source=readFileSync(file,'utf8');assert.ok(!/gemini|api\/my-player-art|licensedPlayerPortrait|three\/|WebGLRenderer|setInterval\(/.test(source),`${file} must not add generation calls, real photos or continuous rendering`);
}
const css=readFileSync('solo/soloPresentation.css','utf8');assert.ok(css.includes('100dvh')&&css.includes('safe-area-inset-bottom')&&css.includes('prefers-reduced-motion'));
console.log(JSON.stringify({playersChecked:SOLO_PLAYERS_DATABASE.length,teamsChecked:SOLO_TEAM_THEMES.length,baseFaces:FACE_COUNT,hairStyles:HAIR_COUNT,facialHairStyles:FACIAL_HAIR_COUNT,eyeBlackStyles:EYE_BLACK_COUNT,exactUniqueAppearances:signatures.size,uniqueRatio:Number(uniqueRatio.toFixed(3)),worstExactCollision:worstCollision,sharedArtBytes:sharedBytes,creatorArtBytes:creatorBytes,identityMigrationAndFailureCases:'passed',physicalIphoneVerified:false,visualFidelityApproved:false},null,2));
