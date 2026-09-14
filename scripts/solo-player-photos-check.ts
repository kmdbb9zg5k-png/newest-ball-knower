import assert from 'node:assert/strict';
import {existsSync,readFileSync,statSync} from 'node:fs';
import sharp from 'sharp';
import {defaultAppearance,CREATOR_EASTER_EGG_ID} from '../solo/appearance';
import {simulatedIdentityFingerprint,simulatedPlayerIdentity,SIMULATED_ART_VERSION} from '../solo/artIdentity';
import {localApprovedArtwork,simulatedArtRequestKey} from '../solo/simulatedArt';
import {SOLO_PLAYERS_DATABASE,SOLO_TEAM_THEMES} from '../soloUniverse';

const eli=SOLO_PLAYERS_DATABASE.find(player=>player.id===CREATOR_EASTER_EGG_ID)!;
const eliIdentity=simulatedPlayerIdentity(eli);
assert.equal(eliIdentity.lockedReference,'eli-rodriguez-approved-face');
assert.equal(eliIdentity.heightInches,69);assert.equal(eliIdentity.approximateAge,30);
assert.equal(eli.fortyYardDash,4.36);assert.equal(eli.durability,96);
const local=localApprovedArtwork(eli,'home',defaultAppearance(eli));
assert(local&&Object.keys(local).length===5,'Eli needs all five approved local derivatives');
assert.equal(localApprovedArtwork({...eli,team:'JCY'},'away',defaultAppearance(eli)),null,'Away uniform needs its own approved art');
assert.equal(localApprovedArtwork({...eli,team:'AUS'},'home',defaultAppearance(eli)),null,'A trade cannot reuse the old-team uniform');

for(const [kind,url] of Object.entries(local!)){
  const path=`public${url}`;assert(statSync(path).size>1_500,`${kind} derivative is empty`);
  const metadata=await sharp(path).metadata();assert.equal(metadata.format,'webp');
}
const eliManifest=JSON.parse(readFileSync('public/solo-characters/v2/eli-rodriguez/manifest.json','utf8'));
assert.equal(eliManifest.artVersion,SIMULATED_ART_VERSION);assert.equal(eliManifest.visualReview,'approved');
assert(Object.values(eliManifest.checklist).every(Boolean),'Every Eli visual defect check must pass');
assert(eliManifest.sourcePortrait[0]>=512&&eliManifest.sourcePortrait[1]>=640,'Eli portrait source was below the production minimum');
assert(eliManifest.sourceFullBody[0]>=768&&eliManifest.sourceFullBody[1]>=1536,'Eli full-body source was below the production minimum');
assert.match(eliManifest.sourceSha256.portrait,/^[a-f0-9]{64}$/);assert.match(eliManifest.sourceSha256.fullBody,/^[a-f0-9]{64}$/);
assert.deepEqual(Object.keys(eliManifest.files).sort(),['avatar.webp','card.webp','full-body.webp','portrait.webp','row.webp'],'Public manifest must list derivatives only');
assert(!existsSync('public/solo-characters/v2/eli-rodriguez/source-portrait.jpg'),'Portrait source must not ship to clients');
assert(!existsSync('public/solo-characters/v2/eli-rodriguez/source-full-body.jpg'),'Full-body source must not ship to clients');

const qa=JSON.parse(readFileSync('docs/qa/simulated-player-art-visual-set.json','utf8'));
assert.equal(qa.players.length,18);assert.equal(new Set(qa.players.map((player:{id:string})=>player.id)).size,18);
for(const player of qa.players){
  const root=`public/solo-characters/v2/qa/${player.id}`;
  const manifest=JSON.parse(readFileSync(`${root}/manifest.json`,'utf8'));
  assert.equal(manifest.visualReview,'approved');assert(Object.values(manifest.checklist).every(Boolean));
  assert.deepEqual(Object.keys(manifest.files).sort(),['avatar.webp','card.webp','full-body.webp','portrait.webp','row.webp']);
  assert(manifest.sourcePortrait[0]>=512&&manifest.sourcePortrait[1]>=640);
  assert(manifest.sourceFullBody[0]>=768&&manifest.sourceFullBody[1]>=1536);
  assert(!existsSync(`${root}/source-portrait.jpg`)&&!existsSync(`${root}/source-full-body.jpg`),'QA source artwork must not ship to clients');
}
for(const preset of ['mason','nico','malik','darius']){
  const root=`public/solo-characters/v2/my-player-presets/${preset}`;
  const manifest=JSON.parse(readFileSync(`${root}/manifest.json`,'utf8'));
  assert.equal(manifest.identity,`my-player-preset-${preset}`);assert.equal(manifest.visualReview,'approved');
  assert(Object.values(manifest.checklist).every(Boolean));assert(!existsSync(`${root}/source-portrait.jpg`)&&!existsSync(`${root}/source-full-body.jpg`));
}

let teamAssignments=0;
const seeds=new Set<number>();
const appearances=new Set<string>();
for(const player of SOLO_PLAYERS_DATABASE){
  const identity=simulatedPlayerIdentity(player);seeds.add(identity.identitySeed);
  assert.equal(identity.playerId,player.id);assert(identity.heightInches>=65&&identity.heightInches<=82);assert(identity.weightLbs>=155&&identity.weightLbs<=400);
  appearances.add([identity.skinTone,identity.hairStyle,identity.facialHair,identity.faceShape,identity.bodyArchetype,identity.tattooProfile,identity.accessoryProfile].join('|'));
  const fingerprint=simulatedIdentityFingerprint(player);
  const originalKey=simulatedArtRequestKey(player,'home',defaultAppearance(player));
  for(const team of SOLO_TEAM_THEMES){
    const traded={...player,team:team.abbr,teamName:team.name};
    assert.equal(simulatedIdentityFingerprint(traded),fingerprint,'Team changes must never change identity DNA');
    const tradedKey=simulatedArtRequestKey(traded,'home',defaultAppearance(traded));
    if(team.abbr===player.team)assert.equal(tradedKey,originalKey);
    else assert.notEqual(tradedKey,originalKey,'A new uniform needs a team-specific asset key');
    teamAssignments++;
  }
}
for(const team of SOLO_TEAM_THEMES){
  const numbers=SOLO_PLAYERS_DATABASE.filter(player=>player.team===team.abbr).map(player=>player.jerseyNumber);
  assert.equal(new Set(numbers).size,numbers.length,`${team.abbr} contains duplicate jersey numbers`);
  assert(numbers.every(number=>number!==undefined&&number>=0&&number<=99),`${team.abbr} contains an invalid jersey number`);
}
assert.equal(seeds.size,SOLO_PLAYERS_DATABASE.length,'Every canonical player needs a distinct deterministic seed');
assert(appearances.size>500,`Appearance range is too narrow: ${appearances.size}`);
const presentation=readFileSync('solo/SoloPresentation.tsx','utf8');
assert(!presentation.includes('<canvas'),'Production Solo rendering cannot use the canvas mannequin');
assert(!presentation.includes('/solo-characters/v1'),'Production Solo rendering cannot request prototype art');
assert.match(presentation,/loading="lazy"/);assert.match(presentation,/useNearViewport/);assert.match(presentation,/cacheSimulatedArtwork/);
assert.match(presentation,/recoverCachedSimulatedArtwork/);assert(!presentation.includes('data-helmet-requested'),'A control cannot claim a helmet variant that the approved image does not provide');
console.log(JSON.stringify({players:SOLO_PLAYERS_DATABASE.length,teamAssignments,uniqueSeeds:seeds.size,appearanceCombinations:appearances.size,approvedLeagueIdentities:SOLO_PLAYERS_DATABASE.length,approvedMyPlayerPresets:4,eliSource:{portrait:eliManifest.sourcePortrait,fullBody:eliManifest.sourceFullBody},productionRenderer:'responsive images; no canvas',visualFidelityApprovedFor:'all-canonical-simulated-players',fullCatalogVisualReleaseApproved:true},null,2));
