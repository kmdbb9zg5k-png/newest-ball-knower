import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {SOLO_PLAYERS_DATABASE,SOLO_TEAM_THEMES} from '../soloUniverse';
import {buildFranchiseRookieClass} from '../soloFranchiseEngine';
import {appearanceRenderKey,defaultAppearance,readAppearance,saveAppearance,sameAppearance,CREATOR_EASTER_EGG_ID} from '../solo/appearance';
import {playerOnSoloTeam} from '../solo/presentationPlayer';
import {simulatedIdentityFingerprint,simulatedPlayerIdentity,SIMULATED_ART_BUCKET,SIMULATED_ART_VERSION} from '../solo/artIdentity';
import {simulatedArtRequestKey} from '../solo/simulatedArt';

const source=(file:string)=>readFileSync(file,'utf8');
const sample=SOLO_PLAYERS_DATABASE.find(player=>player.position==='LB')!;
const base=defaultAppearance(sample);
const tattoos={...base,tattooCoverage:'both-arms' as const,tattooStyle:'mixed' as const,tattooSeed:12345};
assert(!sameAppearance(base,tattoos),'Tattoo-only changes must remain a distinct approved art variant.');
assert.notEqual(appearanceRenderKey(base),appearanceRenderKey(tattoos));
const values=new Map<string,string>();
const store={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value);},removeItem:(key:string)=>{values.delete(key);}};
assert(saveAppearance(sample,tattoos,store));assert.deepEqual(readAppearance(sample,store),tattoos);

let tradeCases=0;
for(const player of SOLO_PLAYERS_DATABASE){
  const fingerprint=simulatedIdentityFingerprint(player);
  for(const team of SOLO_TEAM_THEMES){
    const traded=playerOnSoloTeam(player,team.abbr);
    assert.equal(traded.id,player.id);assert.equal(traded.team,team.abbr);assert.equal(traded.teamName,team.name);
    assert.equal(simulatedIdentityFingerprint(traded),fingerprint,'Trades cannot mutate face/body identity');
    const before=simulatedArtRequestKey(player,'home',defaultAppearance(player));
    const after=simulatedArtRequestKey(traded,'home',defaultAppearance(traded));
    if(team.abbr===player.team)assert.equal(after,before);else assert.notEqual(after,before,'Trade must request a new-team uniform asset');
    tradeCases++;
  }
}
const rookieClasses=[2027,2028].map(year=>({year,players:buildFranchiseRookieClass(year)}));
const rookies=rookieClasses.flatMap(entry=>entry.players);
assert.equal(new Set(rookies.map(player=>player.id)).size,rookies.length);
for(const {year,players} of rookieClasses){
  for(const rookie of players){
    const stableId=`franchise-rookie-${year}-${rookie.id}`;
    const rookiePlayer={...rookie,id:stableId,playerId:stableId,team:'FA'};
    const identity=simulatedPlayerIdentity(rookiePlayer);
    assert.equal(identity.playerId,stableId);assert.equal(simulatedIdentityFingerprint(rookiePlayer),simulatedIdentityFingerprint({...rookiePlayer,team:'JCY'}));
  }
}
const eli=SOLO_PLAYERS_DATABASE.find(player=>player.id===CREATOR_EASTER_EGG_ID)!;
assert.equal(eli.name,'Eli Rodriguez');assert.equal(eli.ovr,85);assert.equal(eli.heightInches,69);assert.equal(eli.fortyYardDash,4.36);assert.equal(eli.experience,10);assert.equal(eli.age,30);assert((eli.durability??0)>=95);

const presentation=source('solo/SoloPresentation.tsx'),profile=source('solo/SoloPlayerProfile.tsx');
assert.doesNotMatch(presentation,/<canvas|characterRenderer|portraitAsset|solo-characters\/v1/);
assert.match(presentation,/useSimulatedArtwork/);assert.match(presentation,/fullBody/);assert.match(presentation,/loading="lazy"/);assert.match(presentation,/recoverCachedSimulatedArtwork/);
assert.match(profile,/Persistent player identity/);assert.match(profile,/heightInches/);assert.match(profile,/fortyYardDash/);assert.match(profile,/durability/);
assert.match(source('MyPlayerStory.tsx'),/MyPlayerSharedRender as PlayerRender/);
assert.match(source('solo/MyPlayerSharedRender.tsx'),/customFaceSrc=\{profile\.faceImage\|\|myPlayerPresetPortrait/);
assert.match(source('PlayerAgentMode.tsx'),/playerOnSoloTeam\(player,client.currentTeam\)/);

for(const obsolete of ['solo/characterRenderer.ts','solo/portraitAsset.ts','solo/imageLoader.ts','solo/tattooMask.ts','public/solo-characters/v1/manifest.json'])assert(!existsSync(obsolete),'Obsolete prototype remains: '+obsolete);
const api=source('api/simulated-player-art.ts'),migration=source('migrations/20260913142719_simulated_player_art_v4.sql');
assert.match(api,/SUPABASE_SERVICE_ROLE_KEY/);assert.match(api,/SIMULATED_PLAYER_ART_ADMIN_KEY/);assert.match(api,/status:'pending_review'/);assert.match(api,/image_size:full\?'2K':'1K'/);
assert.match(api,/appearanceRenderKey\(appearance\)/);assert.match(api,/\['BK','FA'\]/);
assert.match(api,/reusableIdentityAnchor/);assert.match(api,/identity_anchor_path/);assert.match(api,/Every production visual check must pass before approval/);
assert.match(api,/resize\(96,96/);assert.match(api,/resize\(160,200/);assert.match(api,/resize\(384,480/);assert.match(api,/resize\(640,800/);assert.match(api,/resize\(768,1152/);
assert.match(migration,new RegExp(SIMULATED_ART_BUCKET));assert.match(migration,/enable row level security/);assert.match(migration,/grant select .* anon,authenticated/);assert.match(migration,/status='approved'/);
assert.match(migration,/identity_anchor_path is not null/);
assert.doesNotMatch(source('OwnerBusinessMode.tsx'),/owner-trade-request\.png/);assert.match(source('OwnerBusinessMode.tsx'),/SoloPortrait/);
assert.match(source('FranchiseSeason.tsx'),/franchise-rookie-/);assert.match(source('FranchiseSeason.tsx'),/SoloPortrait/);

const qa=JSON.parse(source('docs/qa/simulated-player-art-visual-set.json'));
const catalog=JSON.parse(source('docs/qa/simulated-player-art-catalog.json'));
assert.equal(qa.players.length,18);assert(Object.values(qa.approvedByGroup).every(count=>Number(count)>=2));
assert(Object.values(qa.finalAssetChecklist).every(defect=>defect===false));
assert.equal(catalog.approvedPlayers,19);assert.equal(catalog.pendingPlayers,SOLO_PLAYERS_DATABASE.length-19);assert.equal(catalog.releaseApproved,false);
for(const id of catalog.approvedLocalPlayers){
  const root=id===CREATOR_EASTER_EGG_ID?'public/solo-characters/v2/eli-rodriguez':`public/solo-characters/v2/qa/${id}`;
  assert(existsSync(`${root}/manifest.json`),`Missing approved manifest for ${id}`);
  assert(!existsSync(`${root}/source-portrait.jpg`)&&!existsSync(`${root}/source-full-body.jpg`),`High-resolution source leaked for ${id}`);
}

const modeFiles=['SoloMode.tsx','FantasyFranchise.tsx','RealTeamFranchise.tsx','PlayerAgentMode.tsx','OwnerBusinessMode.tsx','MyPlayerStory.tsx'];
for(const file of modeFiles)assert(source(file).includes('./solo/SoloPresentation')||source(file).includes('./solo/MyPlayerSharedRender'),file+' must use the shared simulated-player presentation');
mkdirSync('artifacts/solo-art-audit',{recursive:true});
const report={functionalArchitectureChecks:'passed',representativeVisualSet:'passed',artVersion:SIMULATED_ART_VERSION,players:SOLO_PLAYERS_DATABASE.length,tradeCases,rookies:rookies.length,obsoletePrototypeRemoved:true,sharedImageRenderer:true,serverGenerationAndStorageContract:true,approvedLocalPlayers:catalog.approvedLocalPlayers,approvedMyPlayerPresets:4,remainingVisualBlockers:['Generate and visually approve the remaining 1,677 canonical-player identities.','Run the React browser QA workflow in CI.','Run the physical iPhone visual pass.'],visualFidelityApproved:false,physicalIphoneVerified:false};
writeFileSync('artifacts/solo-art-audit/source-audit.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
