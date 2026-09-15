import{mul,translate,scale,rx,ry,rz,pose,segment,hex,point}from'./renderer.js';
import{advanceMotion,samplePose,footTarget,twoBone,readyHandTarget}from'./motion.js';
import{createTorsoGeometry}from'./geometry.js';
export{advanceMotion};
const white=hex('#e6e8e2'),dark=hex('#111a22'),gold=hex('#d8b66e');
const skinTones=['#a46d49','#633d2d','#ba8b66','#8b563b'].map(hex);
const leather=hex('#81482b'),visor=hex('#233c48');
const kit=[
 {jersey:hex('#173349'),pants:hex('#203548'),helmet:hex('#bba275'),trim:gold,cloth:'#173349',ink:'#f1ecda'},
 {jersey:hex('#e6e8e0'),pants:hex('#a8afb2'),helmet:hex('#863d3b'),trim:hex('#8f4640'),cloth:'#e6e8e0',ink:'#74322f'}
];
export function prepareJerseys(r,actors){
 if(!r.shapes.torso)r.shapes.torso=createTorsoGeometry();
 for(const p of actors){
  const key='jersey-'+p.team+'-'+p.number;if(r.textures.has(key))continue;
  const c=document.createElement('canvas');c.width=128;c.height=128;
  const ctx=c.getContext('2d'),k=kit[p.team];ctx.fillStyle=k.cloth;ctx.fillRect(0,0,128,128);
  ctx.strokeStyle=p.team?'#c3c9c333':'#55708033';ctx.lineWidth=.5;
  for(let y=0;y<128;y+=4){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y);ctx.stroke()}
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='800 12px system-ui';ctx.fillStyle=k.ink;ctx.fillText(p.team?'RIVALS':'KNOWERS',64,18);
  ctx.font='900 78px Arial';ctx.lineWidth=3;ctx.strokeStyle=p.team?'#9eaaa4':'#9c834a';ctx.strokeText(String(p.number),64,72);ctx.fillStyle=k.ink;ctx.fillText(String(p.number),64,72);
  r.texture(key,c);
 }
}
const mixPoint=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const torsoFrame=q=>mul(translate(0,q.pelvis,0),mul(ry(q.twist),mul(rz(q.turn),rx(q.lean))));
/* Blend a ground/ready hand target into the existing action pose, then solve
   the arm with fixed segment lengths. This never moves the actor or camera. */
export function resolveArm(p,q,side,phase,torso=torsoFrame(q)){
 const shoulder=mul(torso,translate(side*.315,.458,0));
 const swing=Math.sin(q.gait+(side===1?Math.PI:0)+Math.PI);
 let angle=-.15+swing*(.62+.12*q.sprint)*q.drive,elbow=-.94-.20*q.drive;
 angle=angle*(1-q.block)-1.08*q.block;
 elbow=elbow*(1-q.block)-.50*q.block;
 if(p.hasBall&&side===1){angle=-.50;elbow=-1.72}
 if(p.role==='QB'&&(phase==='pass'||phase==='pre')){angle=-.55;elbow=-1.82}
 if(q.throwWeight>0&&p.role==='QB'&&side===1){angle=-2.55+q.throwProgress*2.35;elbow=-1.30+q.throwProgress*1.10}
 angle=angle*(1-q.catch)-1.54*q.catch;elbow=elbow*(1-q.catch)-.38*q.catch;
 const upper=mul(shoulder,mul(rz(side*.12),rx(angle)));
 const fore=mul(mul(upper,translate(0,-.355,0)),rx(elbow));
 const start=point(shoulder,[0,0,0]),joint=point(fore,[0,0,0]),end=point(fore,[0,-.333,.011]);
 const weight=q.ready*(1-q.catch)*(1-q.throwWeight)*(1-q.fall);
 if(weight<.0001)return{start,joint,end};
 const target=mixPoint(end,readyHandTarget(p.role,side),weight);
 return {start,...twoBone(start,target,.355,Math.hypot(.333,.011),[side*.8,-.12,-.38])};
}
/* Articulated bodies use game-driven pose blends. Geometry, textures and
   equipment are shared; no player photos, generated images or external assets. */
export function drawAthlete(r,p,time,phase){
 const k=kit[p.team],q=samplePose(p),build=q.build,skin=skinTones[p.index%skinTones.length];
 const height=build.height*(.99+(p.index%3)*.01);
 let root=mul(mul(translate(p.x,.15*q.fall,p.z),ry(p.heading||0)),rx(q.fall*1.38));
 root=mul(root,scale(build.width,height,1));
 const ell=(base,x,y,z,sx,sy,sz,color,shine=0)=>r.add('sphere',mul(base,pose(x,y,z,sx,sy,sz)),color,'',false,shine);
 const box=(base,x,y,z,sx,sy,sz,color)=>r.add('cube',mul(base,pose(x,y,z,sx,sy,sz)),color);
 const bone=(base,a,b,radius,color)=>r.add('sphere',mul(base,mul(segment(a,b,radius),scale(1,.55,1))),color);
 const torso=torsoFrame(q),chest=mul(root,torso);
 ell(root,0,q.pelvis,0,.222,.155,.165,k.pants);
 r.add('torso',mul(chest,pose(0,.295,0,.285,.58,.172)),k.jersey);
 box(chest,0,.018,0,.405,.036,.311,dark);
 // Jersey side seams and a close-fitting collar avoid oversized round pads.
 for(const side of[-1,1]){
  bone(chest,[side*.22,.08,.02],[side*.271,.36,.025],.015,k.trim);
  ell(chest,side*.265,.46,0,.118,.119,.164,k.jersey);
 }
 ell(chest,0,.587,0,.091,.069,.094,dark);ell(chest,0,.64,.005,.079,.083,.078,skin);
 const head=mul(mul(mul(chest,translate(0,.79,.012)),rx(-q.lean*.80)),scale(.97));
 ell(head,0,-.018,.029,.126,.157,.13,skin);
 r.add('helmet',mul(head,scale(.174,.204,.204)),k.helmet,'',false,.48);
 for(const side of[-1,1]){
  ell(head,side*.163,-.022,0,.026,.078,.075,k.helmet,.22);
  ell(head,side*.18,-.043,.016,.009,.024,.022,dark);
  bone(head,[side*.147,-.06,.11],[side*.061,-.164,.15],.011,white);
 }
 // Crown stripe, rear bumper and chin cup, with no licensed insignia.
 for(let j=0;j<9;j++){const a=-1.65+j*.28,b=a+.30;r.add('cylinder',mul(head,segment([0,Math.cos(a)*.206,Math.sin(a)*.207],[0,Math.cos(b)*.206,Math.sin(b)*.207],.012)),p.team?white:k.jersey)}
 box(head,0,-.062,-.178,.20,.041,.012,white);
 ell(head,0,-.155,.177,.073,.027,.040,white);
 const bars=[[[ -.165,-.062,.14],[-.13,-.127,.272]],[[.165,-.062,.14],[.13,-.127,.272]],[[-.13,-.127,.272],[.13,-.127,.272]],[[-.142,-.052,.252],[.142,-.052,.252]],[[-.142,-.052,.252],[-.13,-.127,.272]],[[.142,-.052,.252],[.13,-.127,.272]]];
 if(p.role==='OL'||p.role==='DL')bars.push([[-.05,-.052,.252],[-.05,-.127,.272]],[[.05,-.052,.252],[.05,-.127,.272]]);
 for(const[a,b]of bars)r.add('cylinder',mul(head,segment(a,b,.010)),dark,'',false,.24);
 // A dark visor on skill positions, open face on the line and quarterback.
 if(['WR','RB','DB'].includes(p.role))box(head,0,-.005,.175,.23,.069,.018,visor);
 else {for(const side of[-1,1])ell(head,side*.043,.004,.151,.018,.009,.007,dark)}
 // Orient each number panel for its viewing side; keep cloth normals outward.
 const jersey='jersey-'+p.team+'-'+p.number;
 r.add('plane',mul(mul(chest,translate(0,.318,-.181)),mul(rx(Math.PI/2),scale(-.33,-1,.31))),[1,1,1,1],jersey);
 r.add('plane',mul(mul(chest,translate(0,.318,.181)),mul(rx(-Math.PI/2),scale(.33,-1,-.31))),[1,1,1,1],jersey);
 for(const side of[-1,1]){
  const foot=footTarget(q,side),hip=[side*.141,q.pelvis,0],leg=twoBone(hip,foot,.50,.50,[0,0,1]);
  bone(root,hip,leg.joint,build.leg,k.pants);
  ell(root,...leg.joint,build.leg*.94,.090,build.leg*.99,k.pants);
  bone(root,leg.joint,leg.end,build.leg*.73,k.pants);
  // Stripes follow the articulated thigh rather than a floating texture card.
  const thighStripeA=hip.map((v,i)=>v+(i===0?side*build.leg*.87:0));
  const thighStripeB=leg.joint.map((v,i)=>v+(i===0?side*build.leg*.87:0));
  r.add('cylinder',mul(root,segment(thighStripeA,thighStripeB,.015)),k.trim);
  const ankle=leg.end;
  ell(root,ankle[0],ankle[1]+.065,ankle[2],.076,.047,.077,white);
  ell(root,ankle[0],ankle[1]-.020,ankle[2]+.064,.086,.052,.153,dark);
  box(root,ankle[0],Math.max(.016,ankle[1]-.056),ankle[2]+.065,.150,.020,.259,dark);
  box(root,ankle[0],ankle[1]+.027,ankle[2]+.13,.068,.010,.063,k.trim);
  const arm=resolveArm(p,q,side,phase,torso);
  // Short sleeves and tapered exposed arms keep a continuous silhouette.
  const sleeveEnd=mixPoint(arm.start,arm.joint,.43);
  bone(root,arm.start,sleeveEnd,build.arm*1.16,k.jersey);
  bone(root,mixPoint(arm.start,arm.joint,.40),mixPoint(arm.start,arm.joint,.46),build.arm*1.17,k.trim);
  bone(root,mixPoint(arm.start,arm.joint,.44),arm.joint,build.arm*.94,skin);
  ell(root,...arm.joint,build.arm*.89,build.arm*.91,build.arm*.91,skin);
  const cuff=mixPoint(arm.joint,arm.end,.83);
  bone(root,arm.joint,cuff,build.arm*.79,p.index%4===0?dark:skin);
  bone(root,mixPoint(arm.joint,arm.end,.79),mixPoint(arm.joint,arm.end,.87),build.arm*.82,white);
  bone(root,cuff,arm.end,build.arm*.77,p.role==='QB'?skin:white);
 }
 if(p.hasBall){
  const qb=p.role==='QB';const ballM=mul(chest,mul(translate(qb?0:.184,qb?.21:.16,qb?.305:.23),rz(qb?1.15:-.28)));
  ell(ballM,0,0,0,.091,.188,.088,leather);box(ballM,0,0,.088,.017,.117,.006,white);
  for(let i=-2;i<=2;i++)box(ballM,0,i*.020,.092,.047,.006,.005,white);
 }
}
