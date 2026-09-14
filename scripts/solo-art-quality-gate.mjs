import {existsSync,readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
const failures=[];
for(const path of ['solo/characterRenderer.ts','solo/portraitAsset.ts','solo/imageLoader.ts','solo/tattooMask.ts','public/solo-characters/v1']){
  if(existsSync(path))failures.push('Obsolete prototype remains in the production tree: '+path);
}
const eli=JSON.parse(read('public/solo-characters/v2/eli-rodriguez/manifest.json'));
if(eli.artVersion!==4||eli.visualReview!=='approved'||!Object.values(eli.checklist??{}).every(Boolean))failures.push('Eli Rodriguez has not passed the v4 visual checklist.');
const myPlayer=read('MyPlayerStory.tsx');
if(/face\.skin|face\.hair|radial-gradient\(circle/.test(myPlayer))failures.push('My Player still contains a CSS-drawn prototype face.');
for(const preset of ['mason','nico','malik','darius']){
  const root=`public/solo-characters/v2/my-player-presets/${preset}`;
  if(!existsSync(`${root}/portrait.webp`)||!existsSync(`${root}/manifest.json`))failures.push(`My Player preset ${preset} is missing reviewed artwork.`);
  else {const manifest=JSON.parse(read(`${root}/manifest.json`));if(manifest.visualReview!=='approved'||!Object.values(manifest.checklist??{}).every(Boolean))failures.push(`My Player preset ${preset} has not passed visual QA.`);}
}
const catalogPath='docs/qa/simulated-player-art-catalog.json';
if(!existsSync(catalogPath))failures.push('No reviewed full-catalog snapshot exists.');
else {
  const catalog=JSON.parse(read(catalogPath));
  if(catalog.expectedPlayers!==1696||catalog.approvedPlayers!==catalog.expectedPlayers)failures.push('The complete 1,696-player catalog is not approved.');
  if(catalog.duplicateIdentityGroups!==0)failures.push('The approved catalog contains duplicated identities.');
  if(catalog.prototypeFallbacks!==0)failures.push('The approved catalog still depends on prototype fallbacks.');
}
const qaPath='docs/qa/simulated-player-art-visual-set.json';
if(!existsSync(qaPath))failures.push('The representative multi-position visual QA set is incomplete.');
else {
  const qa=JSON.parse(read(qaPath));
  for(const group of ['QB','RB','WR','TE','OL','DL','LB','DB','K'])if((qa.approvedByGroup?.[group]??0)<2)failures.push(group+' needs at least two visually approved players.');
  for(const defect of ['distortedEyes','duplicatedFeatures','malformedEars','mangledHands','warpedJerseys','unreadableNumbers','identityMismatch','cartoonAppearance','blurryExpanded'])if((qa.rejectedDefects?.[defect]??-1)<0)failures.push('QA evidence is missing the '+defect+' defect check.');
  if(!Array.isArray(qa.players)||qa.players.length<18)failures.push('The visual set must contain at least 18 reviewed players.');
  else {
    if(new Set(qa.players.map(player=>player.id)).size!==qa.players.length)failures.push('The visual set contains duplicated player IDs.');
    for(const player of qa.players){
      const root=`public/solo-characters/v2/qa/${player.id}`;
      for(const name of ['avatar.webp','row.webp','card.webp','portrait.webp','full-body.webp','manifest.json'])if(!existsSync(`${root}/${name}`))failures.push(`Missing ${name} for ${player.id}.`);
      if(existsSync(`${root}/manifest.json`)){
        const manifest=JSON.parse(read(`${root}/manifest.json`));
        if(manifest.visualReview!=='approved'||!Object.values(manifest.checklist??{}).every(Boolean))failures.push(`${player.id} has not passed its derivative review manifest.`);
      }
    }
  }
  if(!qa.finalAssetChecklist||Object.values(qa.finalAssetChecklist).some(Boolean))failures.push('At least one defect remains in the final representative visual set.');
}
const physicalIphoneVerified=false;
if(!physicalIphoneVerified)failures.push('Physical iPhone artwork verification is still required.');
const approvedLocalAssets=existsSync(catalogPath)?JSON.parse(read(catalogPath)).approvedLocalPlayers??[]:[];
console.log(JSON.stringify({visualReleaseAllowed:failures.length===0,failures,approvedLocalAssets,physicalIphoneVerified},null,2));
if(failures.length)process.exitCode=1;
