import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {SOLO_PLAYERS_DATABASE,SOLO_TEAM_THEMES} from '../soloUniverse';
import {buildFranchiseRookieClass} from '../soloFranchiseEngine';
import {appearanceRenderKey,defaultAppearance,readAppearance,saveAppearance,sameAppearance,CREATOR_EASTER_EGG_ID,uniformFor} from '../solo/appearance';
import {playerOnSoloTeam} from '../solo/presentationPlayer';
import {maskTattooInk} from '../solo/tattooMask';

const source=(file:string)=>readFileSync(file,'utf8');
const sample=SOLO_PLAYERS_DATABASE.find(p=>p.position==='LB')!;
const base=defaultAppearance(sample);
const tattoos={...base,tattooCoverage:'both-arms' as const,tattooStyle:'mixed' as const,tattooSeed:12345};
assert(!sameAppearance(base,tattoos),'Tattoo-only changes must mark the editor dirty.');
for(const key of ['tattooCoverage','tattooStyle','tattooSeed'] as const){
 const edited={...base,[key]:tattoos[key]===base[key]?(key==='tattooSeed'?54321:'none'):tattoos[key]};
 assert.notEqual(appearanceRenderKey(base),appearanceRenderKey(edited),'Every tattoo field must invalidate rendering.');
}
assert(sameAppearance(base,Object.fromEntries(Object.entries(base).reverse()) as typeof base),'Object property order is not a visual change.');
const values=new Map<string,string>();
const store={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
assert(saveAppearance(sample,tattoos,store));
assert.deepEqual(readAppearance(sample,store),tattoos,'Tattoo-only edits must survive reload.');

const regions=new Uint8ClampedArray([
 0,0,255,255, 255,0,0,255, 0,255,0,255, 0,0,0,255,
 255,0,255,255, 0,0,255,0, 0,0,255,255, 0,0,255,255,
]);
const body=new Uint8ClampedArray(32).fill(255);body[27]=0;body[31]=128;
const ink=new Uint8ClampedArray(32).fill(160);
maskTattooInk(ink,regions,body);
assert.deepEqual(Array.from(ink).filter((_,index)=>index%4===3),[160,0,0,0,0,0,0,80]);
assert.throws(()=>maskTattooInk(new Uint8ClampedArray(4),regions,body),/identical RGBA/);

let tradeCases=0;
for(const player of SOLO_PLAYERS_DATABASE){
 const identity=appearanceRenderKey(defaultAppearance(player));
 for(const team of SOLO_TEAM_THEMES){
  const traded=playerOnSoloTeam(player,team.abbr);
  assert.equal(traded.id,player.id);
  assert.equal(traded.team,team.abbr);
  assert.equal(traded.teamName,team.name);
  assert.equal(traded.ovr,player.ovr);
  assert.equal(traded.salary,player.salary);
  assert.equal(appearanceRenderKey(defaultAppearance(traded)),identity);
  for(const variant of ['home','away','alternate'] as const)assert.equal(uniformFor(traded,variant).abbr,team.abbr);
  tradeCases++;
 }
}
const rookies=[...buildFranchiseRookieClass(2027),...buildFranchiseRookieClass(2028)];
assert.equal(new Set(rookies.map(p=>p.id)).size,rookies.length);
for(const rookie of rookies){
 const prospect={...rookie,team:'FA'};
 assert(sameAppearance(defaultAppearance(prospect),defaultAppearance(JSON.parse(JSON.stringify(prospect)))));
}
const eli=SOLO_PLAYERS_DATABASE.find(p=>p.id===CREATOR_EASTER_EGG_ID)!;
assert(eli);assert.equal(eli.name,'Eli Rodriguez');assert.equal(eli.ovr,85);
assert.equal(defaultAppearance(eli).tattooCoverage,'full-sleeve');
assert.equal(playerOnSoloTeam(sample,'PHI'),sample,'Unknown/real team identifiers must not introduce real-team art.');

const presentation=source('solo/SoloPresentation.tsx'),profile=source('solo/SoloPlayerProfile.tsx'),renderer=source('solo/characterRenderer.ts');
assert.match(presentation,/appearanceRenderKey\(look\)/);
assert.match(profile,/const sameLook=sameAppearance/);
assert.match(profile,/Tattoo coverage/);assert.match(profile,/Tattoo style/);
assert.doesNotMatch(presentation,/bk-solo-portrait-(hair|beard|eye-black)/);
assert.doesNotMatch(renderer,/drawHairAndFaceDetails/);
assert.match(renderer,/maskTattooInk\(pixels.data,regions,body\)/);
assert.match(renderer,/drawTattoos\(ctx,look,mask,pixels.data\)/);
assert.match(source('PlayerAgentMode.tsx'),/playerOnSoloTeam\(player,client.currentTeam\)/);
assert.match(source('MyPlayerStory.tsx'),/from ['"]\.\/myPlayerCombine['"]/);
assert.match(source('scripts/solo-fictional-universe-check.ts'),/from ['"]\.\.\/myPlayerCombine['"]/);
assert.match(source('scripts/phase1-correctness-check.ts'),/from ['"]\.\.\/agentTradeRules['"]/);

const modeFiles=['SoloMode.tsx','FantasyFranchise.tsx','RealTeamFranchise.tsx','PlayerAgentMode.tsx','OwnerBusinessMode.tsx','MyPlayerStory.tsx'];
const modes=modeFiles.map(file=>({file,sharedPresentation:source(file).includes("./solo/SoloPresentation"),separateLegacyPlayerPreview:file==='MyPlayerStory.tsx'&&source(file).includes('const PlayerRender ='),scope:file==='OwnerBusinessMode.tsx'?'Staff portraits and narrative scene, not a full player-roster mode':'Player-facing Solo mode'}));
const manifest=JSON.parse(source('public/solo-characters/v1/manifest.json'));
const remainingVisualBlockers=[
 'Profile artwork still uses the nine-face prototype. Native face resolution is 96x120; body resolution is 149x448.',
 'My Player still has a separate CSS-built body preview and optional generated image; it is not yet on the shared renderer.',
 'Uniform numbers, procedural tattoos, equipment and body widths need detailed photographic/material-aware artwork.',
 'Creator height, explicit forty time and injury durability still need production-field verification.',
 'Passing identity/configuration tests does not prove distinct realistic faces or approved visual quality.',
];
mkdirSync('artifacts/solo-art-audit',{recursive:true});
const report={functionalRepairChecks:'passed',players:SOLO_PLAYERS_DATABASE.length,tradeCases,rookies:rookies.length,modes,artwork:{faces:manifest.faces,faceCell:manifest.faceCell,body:manifest.body,review:manifest.artReview},remainingVisualBlockers,visualFidelityApproved:false,physicalIphoneVerified:false,allModesEndToEndVerified:false};
writeFileSync('artifacts/solo-art-audit/source-audit.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
