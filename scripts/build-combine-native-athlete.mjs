// Usage: BROWSER_PATH=/tmp/chromium node scripts/build-combine-native-athlete.mjs /path/to/extracted/files
// Expected files: rig.fbx, Fast Run.fbx, Walking.fbx, Breathing Idle.fbx,
// base.png, normal.png, roughnes.PNG (flatten the supplied nested archives).
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const source=path.resolve(process.argv[2]);
const allowed=new Set(['rig.fbx','Fast Run.fbx','Walking.fbx','Breathing Idle.fbx','base.png','normal.png','roughnes.PNG']);
const fixture=`
import * as T from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
const manager=new T.LoadingManager();manager.setURLModifier(u=>/\\.(png|jpg)$/i.test(u)?'/source/base.png':u);
const loader=new FBXLoader(manager),model=await loader.loadAsync('/source/rig.fbx');
const textures=new T.TextureLoader(),base=await textures.loadAsync('/source/base.png');base.colorSpace=T.SRGBColorSpace;
const normal=await textures.loadAsync('/source/normal.png'),rough=await textures.loadAsync('/source/roughnes.PNG');
model.traverse(n=>{if(n.isMesh){n.normalizeSkinWeights();n.geometry=mergeVertices(n.geometry);n.material=new T.MeshStandardMaterial({name:'Athlete fabric and skin',map:base,normalMap:normal,normalScale:new T.Vector2(.65,.65),roughnessMap:rough,roughness:1,metalness:0});}});
const height=new T.Box3().setFromObject(model).getSize(new T.Vector3()).y,scale=1.85/height;
model.scale.setScalar(scale);model.name='CombineAthlete';
const clips=[],strides={};
for(const [file,name]of[['Fast Run','Run'],['Walking','Walk'],['Breathing Idle','Idle']]){
 const source=await loader.loadAsync('/source/'+encodeURIComponent(file)+'.fbx'),clip=source.animations[0].clone();clip.name=name;
 const hips=clip.tracks.find(t=>t.name==='mixamorigHips.position'),last=hips.values.length-3;
 strides[name]=(hips.values[last+2]-hips.values[2])*scale;
 const startX=hips.values[0],startZ=hips.values[2],dx=hips.values[last]-startX,dz=hips.values[last+2]-startZ;
 for(let i=0;i<hips.times.length;i++){const f=hips.times[i]/clip.duration;hips.values[i*3]-=dx*f;hips.values[i*3+2]-=dz*f;}
 clips.push(clip);
}
model.userData={source:'User supplied gangster-male-character-rigged-animated-game-ready.zip',height:1.85,strides};
const buffer=await new GLTFExporter().parseAsync(model,{binary:true,animations:clips});
window.result=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(new Blob([buffer]));});window.ready=true;
`;
const server=await createServer({plugins:[{name:'character-export',configureServer(s){s.middlewares.use(async(req,res,next)=>{const name=decodeURIComponent((req.url||'').replace('/source/',''));if(req.url?.startsWith('/source/')&&allowed.has(name)){try{res.end(await readFile(path.join(source,name)));}catch{res.statusCode=404;res.end();}}else if(req.url==='/export.html'){res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml(req.url,'<script type="module" src="/export.js"></script>'));}else next();});},resolveId(id){if(id==='/export.js')return '\0export';},load(id){if(id==='\0export')return fixture;}}],server:{host:'127.0.0.1',port:3069}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'/tmp/chromium',args:['--no-sandbox']});
try{const page=await browser.newPage();page.on('pageerror',e=>console.error(e));await page.goto('http://127.0.0.1:3069/export.html');await page.waitForFunction(()=>window.ready,{timeout:60000});const bytes=Buffer.from(await page.evaluate(()=>window.result),'base64');await writeFile('public/play-moment-3d/assets/combine-native-athlete-v1.glb',bytes);console.log('Exported native athlete',bytes.length,'bytes');}finally{await browser.close();await server.close();}
