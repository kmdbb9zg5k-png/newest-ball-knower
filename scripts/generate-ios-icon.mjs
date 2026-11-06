import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// Use the approved artwork and the generated template's exact size/idiom list.
// No npm install or third-party asset generator may change the locked build.
const appIcon='ios/App/App/Assets.xcassets/AppIcon.appiconset';
const contents=JSON.parse(await fs.readFile(path.join(appIcon,'Contents.json'),'utf8'));
for(const [index,entry] of contents.images.entries()){
  const size=Number(entry.size?.split('x')[0]);
  const scale=Number(entry.scale?.replace('x','')||1);
  if(!Number.isFinite(size)||!Number.isFinite(scale))throw new Error('Unsupported iOS app-icon template');
  const filename=`ball-knower-${size*scale}-${index}.png`;
  const previousFilename=entry.filename;
  await sharp('public/ball-knower-icon.svg').resize(size*scale,size*scale).flatten({background:'#050608'}).png().toFile(path.join(appIcon,filename));
  entry.filename=filename;
  if(previousFilename&&previousFilename!==filename){
    if(path.basename(previousFilename)!==previousFilename)throw new Error('Unsupported app-icon filename');
    await fs.rm(path.join(appIcon,previousFilename),{force:true});
  }
}
await fs.writeFile(path.join(appIcon,'Contents.json'),JSON.stringify(contents,null,2)+'\n');
console.log('Generated opaque iOS app icons from the approved Ball Knower artwork.');
