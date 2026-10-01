import * as T from 'three';
import { FINISH, YARD } from './dash.js';

const v = (x, y, z) => new T.Vector3(x, y, z);
const up = v(0, 1, 0);
function mat(color, roughness = .85) { return new T.MeshStandardMaterial({ color, roughness }); }
function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(geometry, material); m.position.set(x, y, z); parent.add(m); return m;
}
function box(parent, size, material, at) { return mesh(new T.BoxGeometry(...size), material, parent, ...at); }
function ellipsoid(parent, material, size, at = [0, 0, 0]) { const m = mesh(new T.SphereGeometry(1, 20, 14), material, parent, ...at); m.scale.set(...size); return m; }
function connect(m, a, b, length = 1) { m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize()); m.scale.y = a.distanceTo(b) / length; }
function label(text, color = '#e6efdf', bg = null, w = 512, h = 128) {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const c = canvas.getContext('2d'); if (bg) { c.fillStyle = bg; c.fillRect(0, 0, w, h); }
  c.fillStyle = color; c.font = `800 ${Math.floor(h * .61)}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2, w * .92);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
  return new T.MeshBasicMaterial({ map: texture, transparent: !bg, side: T.DoubleSide, depthWrite: !!bg });
}
function shapedSegment(parent, material, radius, length, profile) {
  const points = profile.map(([y, r]) => new T.Vector2(r * radius, (y - .5) * length));
  return mesh(new T.LatheGeometry(points, 20), material, parent);
}
// Continuous ring meshes keep elbows and knees joined through the full stride.
function flexibleLimb(parent, material, radii) {
  const rings=17, sides=12, positions=new Float32Array(rings*sides*3), indices=[];
  for(let r=0;r<rings-1;r++)for(let j=0;j<sides;j++){const a=r*sides+j,b=r*sides+(j+1)%sides;indices.push(a,a+sides,b,b,a+sides,b+sides);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(positions,3));g.setIndex(indices);
  const m=mesh(g,material,parent);m.frustumCulled=false;
  return (a,b,c)=>{
    const d1=b.clone().sub(a).normalize(),d2=c.clone().sub(b).normalize();
    const center=new T.Vector3(),axis=new T.Vector3(),x=new T.Vector3(),z=new T.Vector3();
    for(let r=0;r<rings;r++){
      const t=r/(rings-1),q=t*2,segment=q<1?0:1,u=q-segment;
      center.copy(segment===0?a:b).lerp(segment===0?b:c,u);
      axis.copy(d1).lerp(d2,T.MathUtils.smoothstep(t,.35,.65)).normalize();
      x.set(1,0,0).addScaledVector(axis,-axis.x).normalize();z.crossVectors(x,axis).normalize();
      const ri=t*(radii.length-1),i=Math.min(radii.length-2,Math.floor(ri)),radius=T.MathUtils.lerp(radii[i],radii[i+1],ri-i);
      for(let j=0;j<sides;j++){const angle=j/sides*Math.PI*2,k=(r*sides+j)*3,cs=Math.cos(angle)*radius,sn=Math.sin(angle)*radius*.91;positions[k]=center.x+x.x*cs+z.x*sn;positions[k+1]=center.y+x.y*cs+z.y*sn;positions[k+2]=center.z+x.z*cs+z.z*sn;}
    }g.attributes.position.needsUpdate=true;g.computeVertexNormals();
  };
}
// A dedicated training body keeps helmets and pads out of the sprint event.
// Rounded anatomical sections are driven by planted-foot IK, with clothing
// over the joints rather than visible mechanical pivots.
function athlete(parent, seed, staff = false) {
  const root = new T.Group(); parent.add(root);
  const skin = mat(['#955f43', '#70462f', '#bc8967', '#54392c'][seed % 4], .88);
  const shirt = mat(staff ? '#344552' : '#15262d'), shorts = mat(staff ? '#232d35' : '#183d32');
  const shoes = mat('#152027', .64), sock = mat('#e7e5da'), hair = mat('#171717');
  const torso = shapedSegment(root, shirt, .245, .52, [[0,.69],[.10,.77],[.3,.81],[.60,1.02],[.82,1.09],[.94,.94],[1,.45]]); torso.scale.z = .67;
  const pelvis = ellipsoid(root, shorts, [.185,.135,.13]);
  const neck = mesh(new T.CylinderGeometry(.058,.073,.12,16),skin,root);
  const head = new T.Group(); root.add(head);
  ellipsoid(head, skin, [.105,.142,.108]);
  ellipsoid(head, skin, [.082,.065,.072],[0,-.09,.015]);
  ellipsoid(head, skin, [.023,.021,.035],[0,-.015,.105]);
  for(const side of [-1,1]) {
    ellipsoid(head, skin, [.022,.043,.025],[side*.104,-.005,0]);
    ellipsoid(head, hair, [.027,.006,.006],[side*.046,.036,.097]);
    ellipsoid(head, mat('#ece7da'), [.019,.009,.008],[side*.043,.018,.100]);
    ellipsoid(head, hair, [.008,.008,.006],[side*.043,.018,.106]);
  }
  ellipsoid(head,hair,[.106,.068,.107],[0,.105,-.004]);
  // Instanced short curls retain a natural silhouette at phone resolution.
  const curls = new T.InstancedMesh(new T.SphereGeometry(.018,7,5),hair,58), dummy = new T.Object3D();
  for(let i=0;i<58;i++){const a=i*2.39996,r=.095*Math.sqrt(i/58);dummy.position.set(Math.cos(a)*r,.142-.035*(r/.095)**2,Math.sin(a)*r);dummy.scale.set(1,1.15+(i%4)*.15,1);dummy.updateMatrix();curls.setMatrixAt(i,dummy.matrix);}head.add(curls);
  const number = mesh(new T.PlaneGeometry(.25,.12),label(staff?'BK':String(10+seed%80),'#aab3b2'),torso,0,.07,-.166);number.rotation.y=Math.PI;
  const limbs = [-1,1].map(side=>{
    const leg = shapedSegment(root,shorts,.115,.30,[[0,.92],[.15,1],[.7,1.03],[1,.8]]);
    const thigh = shapedSegment(root,skin,.102,.48,[[0,.65],[.15,.79],[.5,1.03],[.8,.9],[1,.7]]);
    const knee = ellipsoid(root,skin,[.071,.073,.078]);
    const calf = shapedSegment(root,skin,.075,.46,[[0,.52],[.18,.57],[.5,.9],[.76,1],[1,.72]]);
    const ankle = mesh(new T.CylinderGeometry(.043,.04,.12,16),sock,root);
    const foot = new T.Group(); root.add(foot);ellipsoid(foot,shoes,[.063,.044,.143],[0,.014,.041]);
    for(const x of [-.034,.034])for(const z of [-.04,.08])mesh(new T.CylinderGeometry(.013,.01,.016,6),shoes,foot,x,-.02,z);
    const sleeve = shapedSegment(root,shirt,.089,.20,[[0,.93],[.3,1],[.8,1],[1,.8]]);
    const upper = shapedSegment(root,skin,.067,.29,[[0,.63],[.3,.96],[.6,1],[1,.7]]);
    const elbow = ellipsoid(root,skin,[.047,.05,.048]);
    const lower = shapedSegment(root,skin,.052,.28,[[0,.52],[.2,.63],[.7,1],[1,.8]]);
    const hand = new T.Group();root.add(hand);
    ellipsoid(hand,skin,[.039,.051,.025]);
    for(let i=0;i<4;i++)ellipsoid(hand,skin,[.008,.028,.010],[(i-1.5)*.018,-.04,.009]);
    ellipsoid(hand,skin,[.014,.03,.016],[side*.035,-.012,.014]);
    const legSkin=flexibleLimb(root,skin,[.086,.112,.095,.067,.078,.069,.037]);
    const armSkin=flexibleLimb(root,skin,[.073,.078,.063,.045,.058,.043,.030]);
    for(const part of [thigh,knee,calf,upper,elbow,lower])part.visible=false;
    ellipsoid(foot,sock,[.064,.014,.139],[0,-.018,.042]);
    for(let i=0;i<4;i++)box(foot,[.075,.006,.008],sock,[0,.052,.014+i*.022]);
    box(foot,[.012,.024,.11],mat('#afee5a'),[side*.06,.024,.045]);
    return {legSkin,armSkin,side,leg,thigh,knee,calf,ankle,foot,sleeve,upper,elbow,lower,hand};
  });
  root.traverse(o=>{if(o.isMesh){o.castShadow=!staff;o.receiveShadow=true;}});
  // Analytic two-bone IK. The bend axis is projected perpendicular to the limb.
  function joint(a,b,l1,l2,bend){const delta=b.clone().sub(a),d=Math.min(delta.length(),l1+l2-.0001),axis=delta.normalize(),along=(l1*l1-l2*l2+d*d)/(2*Math.max(.001,d));const perpendicular=bend.clone().addScaledVector(axis,-bend.dot(axis)).normalize();return a.clone().addScaledVector(axis,along).addScaledVector(perpendicular,Math.sqrt(Math.max(0,l1*l1-along*along)));}
  function pose(distance,velocity,stance=true,launch=1,celebrate=0){
    const rate=Math.min(1,velocity/7), phase=distance/3.8*Math.PI*2;
    const blend=stance?0:Math.min(1,launch), eased=blend*blend*(3-2*blend);
    const hip=v(0,.79,-.31).lerp(v(0,(staff?.99:.91)+Math.abs(Math.sin(phase))*.042*rate,0),eased);
    const drive=(1-Math.min(1,Math.max(0,distance)/24))*.28*rate;
    const shoulder=v(0,.61,.18).lerp(hip.clone().add(v(0,.49-drive*.5,.065+drive)),eased);
    connect(torso,hip,shoulder,.52);pelvis.position.copy(hip).add(v(0,-.035,0));
    neck.position.copy(shoulder).add(v(0,.065,.10-.085*eased));
    head.position.copy(shoulder).add(v(0,.18+.04*eased,.16-.135*eased));head.rotation.x=.30-.34*eased;
    limbs.forEach(l=>{
      const {side}=l, stride=phase+(side===1?Math.PI:0);
      const origin=hip.clone().add(v(side*.112,0,0));
      let foot;
      {
        const cycle=((distance/3.8+(side===1?.5:0))%1+1)%1;
        const planted=cycle<.30,t=planted?cycle/.30:(cycle-.30)/.70;
        const z=planted?.43-.98*t:-.55+.98*(t*t*(3-2*t));
        foot=v(side*.12,.045+(planted?0:Math.sin(t*Math.PI)**1.4*.62)*rate,z*rate);
        foot=v(side*.14,.048,side===1?-.80:-.25).lerp(foot,eased);
      }
      const knee=joint(origin,foot,.49,.49,v(0,0,1));
      l.legSkin(origin,knee,foot);connect(l.thigh,knee,origin,.48);connect(l.leg,origin.clone().lerp(knee,.56),origin,.30);l.knee.position.copy(knee);
      connect(l.calf,foot,knee,.46);l.ankle.position.copy(foot).add(v(0,.035,0));
      l.foot.position.copy(foot);l.foot.rotation.x=stance?-.18:Math.max(0,Math.sin(stride))*.3*rate;
      const armStart=shoulder.clone().add(v(side*.218,-.045,0));
      const handTarget=(side===1?v(.24,.035,.36):v(-.28,.58,-.20)).lerp(armStart.clone().add(v(side*.018,-.17+Math.sin(stride)*.13*rate,Math.sin(stride)*.38*rate)),eased);
      if(celebrate>0)handTarget.lerp(armStart.clone().add(v(side*.13,.48,.10)),celebrate);
      if(staff)handTarget.set(side*.24,.96+(seed%3)*.09,.20);
      const elbow=joint(armStart,handTarget,.29,.31,v(0,-.2,-1));
      l.armSkin(armStart,elbow,handTarget);connect(l.upper,elbow,armStart,.29);connect(l.sleeve,armStart.clone().lerp(elbow,.55),armStart,.20);l.elbow.position.copy(elbow);connect(l.lower,handTarget,elbow,.28);l.hand.position.copy(handTarget);l.hand.rotation.x=stance&&side===1?Math.PI/2:-.4;
    });
  }
  pose(0,0,!staff);return {root,pose};
}

export function createCombineScene(host, player, onLost) {
  const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
  host.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','Indoor 40-yard dash track');
  const lost=e=>{e.preventDefault();onLost();};renderer.domElement.addEventListener('webglcontextlost',lost);
  const scene=new T.Scene();scene.background=new T.Color('#253039');scene.fog=new T.Fog('#253039',48,125);
  const camera=new T.PerspectiveCamera(49,1,.05,160);
  scene.add(new T.HemisphereLight('#e0e9f5','#3b5032',1.8));
  const key=new T.DirectionalLight('#fff3df',3.5);key.position.set(-12,24,7);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-9;key.shadow.camera.right=9;key.shadow.camera.top=12;key.shadow.camera.bottom=-12;key.shadow.camera.near=1;key.shadow.camera.far=65;key.shadow.normalBias=.025;key.shadow.bias=-.00015;scene.add(key,key.target);
  const fill=new T.DirectionalLight('#bad3ed',1.3);fill.position.set(15,10,35);scene.add(fill);
  const grass=mat('#607a43');
  const tc=document.createElement('canvas');tc.width=tc.height=256;const ctx=tc.getContext('2d');ctx.fillStyle='#708455';ctx.fillRect(0,0,256,256);
  let rng=71;const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
  for(let i=0;i<20000;i++){const shade=45+Math.floor(random()*70);ctx.strokeStyle=`rgba(${shade},${shade+20},${shade-14},.52)`;const x=random()*256,y=random()*256;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*2,y-1-random()*3);ctx.stroke();}
  const tex=new T.CanvasTexture(tc);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(22,50);tex.anisotropy=4;grass.map=tex;grass.bumpMap=tex;grass.bumpScale=.025;
  const floor=mesh(new T.PlaneGeometry(54,110),grass,scene,0,-.012,28);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;
  const white=mat('#e2e5ce'),orange=mat('#df652e'),metal=mat('#26343a',.55),concrete=mat('#353f45'),seatMat=mat('#263d4b');
  for(let z=-5;z<60;z+=5){const stripe=box(scene,[50,.006,2.5],mat('#476c3d'),[0,-.005,z]);stripe.material.transparent=true;stripe.material.opacity=.15;stripe.receiveShadow=true;}
  for(const x of [-2.2,2.2])box(scene,[.075,.012,FINISH+10],white,[x,.002,(FINISH+4)/2]);
  for(let n=0;n<=40;n+=5){const z=n*YARD;box(scene,[4.45,.009,n%10===0?.09:.045],white,[0,.006,z]);if(n>0&&n%10===0){const number=mesh(new T.PlaneGeometry(1.1,.68),label(String(n)),scene,1.37,.017,z-.45);number.rotation.x=-Math.PI/2;number.rotation.z=Math.PI;}}
  const startLabel=mesh(new T.PlaneGeometry(2.7,.4),label('START'),scene,0,.018,-1.25);startLabel.rotation.x=-Math.PI/2;startLabel.rotation.z=Math.PI;
  const finishLabel=mesh(new T.PlaneGeometry(3.2,.46),label('40 YARD FINISH'),scene,0,.019,FINISH+.6);finishLabel.rotation.x=-Math.PI/2;finishLabel.rotation.z=Math.PI;
  for(const side of [-1,1])for(let z=0;z<=FINISH;z+=YARD*5){box(scene,[.3,.03,.3],orange,[side*2.6,.015,z]);mesh(new T.ConeGeometry(.12,.40,18),orange,scene,side*2.6,.23,z);}
  function gate(z){for(const side of [-1,1]){const x=side*2.93;mesh(new T.CylinderGeometry(.018,.022,.95,9),metal,scene,x,.49,z);box(scene,[.17,.23,.10],metal,[x,1.02,z]);const led=mesh(new T.SphereGeometry(.025,10,7),new T.MeshBasicMaterial({color:'#bbf39b'}),scene,x,1.04,z-.06);for(let i=0;i<3;i++){const a=i*Math.PI*2/3,leg=mesh(new T.CylinderGeometry(.012,.014,1,7),metal,scene);connect(leg,v(x,.57,z),v(x+Math.cos(a)*.28,.02,z+Math.sin(a)*.28));}}}
  [10,20,40].forEach(n=>gate(n*YARD));
  // Repeated seats and roof fixtures use instancing to bound mobile draw calls.
  const seats=new T.InstancedMesh(new T.BoxGeometry(.52,.38,.58),seatMat,2*9*68),o=new T.Object3D();let si=0;
  for(const side of [-1,1])for(let row=0;row<9;row++){
    box(scene,[1,.52,65],concrete,[side*(11+row*.9),row*.62+.15,25]);
    for(let col=0;col<68;col++){o.position.set(side*(11+row*.9),row*.62+.64,col*.86-3);o.updateMatrix();seats.setMatrixAt(si++,o.matrix);}
  }scene.add(seats);
  const backs=new T.InstancedMesh(new T.BoxGeometry(.52,.48,.10),seatMat,si);
  for(let i=0;i<si;i++){seats.getMatrixAt(i,o.matrix);o.matrix.decompose(o.position,o.quaternion,o.scale);o.position.y+=.31;o.position.x+=Math.sign(o.position.x)*.20;o.rotation.y=Math.PI/2;o.updateMatrix();backs.setMatrixAt(i,o.matrix);}scene.add(backs);
  for(const side of [-1,1]){box(scene,[.10,.10,64],metal,[side*9.7,1.0,26]);for(let z=-4;z<58;z+=4)box(scene,[.07,1,.07],metal,[side*9.7,.5,z]);}
  for(const z of [8,26,44])for(const side of [-1,1]){const sign=mesh(new T.PlaneGeometry(6,.65),label('BK  •  PROSPECT COMBINE','#b8eb7a','#15262d'),scene,side*9.4,1.2,z);sign.rotation.y=side<0?Math.PI/2:-Math.PI/2;}

  box(scene,[45,12,.5],mat('#35444c'),[0,5.5,66]);
  const brand=mesh(new T.PlaneGeometry(15,2.1),label('BALL KNOWER  /  COMBINE','#e4ece6','#172a30',1024,128),scene,0,4.1,65.65);brand.rotation.y=Math.PI;
  box(scene,[50,.35,94],mat('#252f36'),[0,15.5,27]);
  const lamps=new T.InstancedMesh(new T.BoxGeometry(2.4,.08,.45),new T.MeshBasicMaterial({color:'#f7f1dc'}),24);let li=0;
  for(let z=-5;z<65;z+=12){box(scene,[44,.32,.24],metal,[0,14.8,z]);for(const x of [-16,-7,7,16]){o.position.set(x,14.55,z);o.updateMatrix();lamps.setMatrixAt(li++,o.matrix);}for(const side of [-1,1])box(scene,[.25,15,.28],metal,[side*21,7.4,z]);}scene.add(lamps);
  // Small standing groups and tables stay outside the athlete's lane.
  for(let i=0;i<7;i++){const person=athlete(scene,21+i,true);person.root.position.set((i%2?1:-1)*(5.2+i%3),0,3+i*5);person.root.rotation.y=i%2?-Math.PI/2:Math.PI/2;person.root.scale.setScalar(.96+(i%3)*.025);}
  for(const z of [6,20,37]){box(scene,[1.5,.09,.64],metal,[6,.82,z]);for(const x of [5.4,6.6])for(const dz of [-.22,.22])box(scene,[.05,.78,.05],metal,[x,.39,z+dz]);box(scene,[.44,.3,.045],mat('#111b21'),[6,1.02,z]);}
  let runner=athlete(scene,player.seed),visualZ=0,previousPhase='idle',settle=0;
  const target=v(),look=v();
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.fov=w<h?53:49;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  function disposeObject(object){const geometries=new Set(),materials=new Set(),textures=new Set();object.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m){materials.add(m);for(const val of Object.values(m))if(val?.isTexture)textures.add(val);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
  function draw(state,dt){
    const active=state.phase==='running',ended=state.phase==='finished';
    if(ended){settle+=dt;visualZ+=Math.max(0,state.velocity-settle*5)*dt;}else{visualZ=state.distance;settle=0;}
    const speed=active?state.velocity:ended?Math.max(0,state.velocity-settle*5):0;
    runner.root.position.z=visualZ;runner.pose(visualZ,speed,!active&&!ended,active?state.clock/.34:1,ended&&settle>1.8?Math.min(1,(settle-1.8)*2):0);
    const portrait=camera.aspect<1;
    target.set(portrait?-1.0:-1.65,portrait?1.65:1.45,visualZ-(portrait?3.45:3.7));
    if(previousPhase!==state.phase&&state.phase==='idle')camera.position.copy(target);else camera.position.lerp(target,1-Math.exp(-dt*9));
    look.set(.10,.72,visualZ+(portrait?1.2:2.2));camera.lookAt(look);
    key.position.set(-10,24,visualZ+6);key.target.position.set(0,0,visualZ+3);
    renderer.render(scene,camera);previousPhase=state.phase;
  }
  camera.position.set(-1,1.65,-3.45);
  return {draw,setAthlete(next){scene.remove(runner.root);disposeObject(runner.root);runner=athlete(scene,next.seed);visualZ=0;settle=0;previousPhase='reset';},dispose(){observer.disconnect();renderer.domElement.removeEventListener('webglcontextlost',lost);disposeObject(scene);renderer.dispose();renderer.domElement.remove();}};
}
