import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {transformSync} from 'esbuild';

const compiled=transformSync(await readFile(new URL('../api/media.ts',import.meta.url),'utf8'),{loader:'ts',format:'cjs'}).code;
const blob=pathname=>({pathname,url:'https://media.test/'+encodeURIComponent(pathname)});
async function library(blobs){
 const module={exports:{}};vm.runInNewContext(compiled,{module,exports:module.exports,console,require:name=>{assert.equal(name,'@vercel/blob');return{list:async()=>({blobs})};}});
 let payload;await module.exports.default({}, {setHeader(){},status(code){assert.equal(code,200);return this;},json(value){payload=value;}});return payload;
}
const inputs=['music/Focus%20Belongs%20to%20Me.mp3','music/You%20Let%20Him%20In.mp3','music/The%20Handover.mp3','music/Original%20Song%20(2)%20Remastered.mp3','music/Original Song.mp3','music/Late_Night-v2.mp3','music/Late-Night (1).mp3','music/G-O-A-T.mp3','music/AFTER-PARTY-(2).mp3','music/ON-THE-SOUTH.wav','music/From-The-A-To-South-Jersey.mp3','another-video.mp4','Creating_football_intro_video_202608160231.mp4'].map(blob);
const first=await library(inputs),titles=first.tracks.map(track=>track.title);
assert(titles.includes('Focus Belongs to Me'),'The new Focus Belongs to Me MP3 should appear automatically when uploaded to Vercel Blob');
assert(titles.includes('You Let Him In'),'The new You Let Him In MP3 should appear automatically when uploaded to Vercel Blob');
assert(titles.includes('The Handover'),'The Handover MP3 must be discovered once uploaded to Vercel Blob');
assert.equal(first.tracks.find(track=>track.title==='The Handover')?.subtitle, 'elifromthesouth','Preserve the artist from the supplied MP3 metadata');
assert.equal(first.tracks.find(track=>track.title==='The Handover')?.manualOnly,undefined,'The Handover must be eligible for automatic shuffle');
assert(first.tracks.filter(t=>/Focus Belongs to Me|You Let Him In/.test(t.title)).every(t=>t.url&&t.manualOnly!==true),'Both uploaded tracks must be playable in automatic rotation');
assert.equal(titles.filter(title=>title==='Original Song').length,1,'Copy/mastering decorations must deduplicate');assert.equal(titles.filter(title=>title==='Late Night').length,1,'Version decorations must deduplicate');assert.equal(titles.filter(title=>/g.?o.?a.?t/i.test(title)).length,1,'Bundled and uploaded titles must deduplicate despite separators');
assert(titles.every(title=>!/(?:remaster|\(\d+\)|v2|\.mp3|%20)/i.test(title)));assert(!titles.some(title=>/after party|on the south|South Jersey/i.test(title)));assert(first.introUrl.endsWith('Creating_football_intro_video_202608160231.mp4'),'Always select the original opening, even when other videos exist');
const original=first.tracks.find(track=>track.title==='Original Song');assert(original.url.includes('Remastered'),'Prefer the actual remastered upload');
const second=await library([blob('music/Additional-Song.mp3'),...inputs]);assert.equal(second.tracks.find(track=>track.title==='Original Song').id,original.id,'A new upload must not change existing soundtrack identities');
console.log('PASS media playlist: actual upload URLs, hidden/retired exclusions, clean copy/master/version titles, punctuation deduplication, remaster preference, intro and stable track IDs');
