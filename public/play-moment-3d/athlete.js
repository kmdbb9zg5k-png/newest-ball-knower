import{mul,translate,scale,rx,ry,rz,pose,segment,hex,point}from'./renderer.js';
import{advanceMotion,samplePose,footTarget,twoBone,readyHandTarget}from'./motion.js';
import{createTorsoGeometry,createLimbGeometry,createPlayerDetailGeometry}from'./geometry.js';
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
 if(!r.shapes.limb)r.shapes.limb=createLimbGeometry();
 if(!r.shapes.playerFace)Object.assign(r.shapes,createPlayerDetailGeometry());
 for(const p of actors){
  const key='jersey-'+p.team+'-'+p.number;if(r.textures.has(key))continue;
  const c=document.createElement('canvas');c.width=256;c.height=256;
  const ctx=c.getContext('2d'),k=kit[p.team];ctx.scale(2,2);ctx.clearRect(0,0,128,128);
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
/* Art-only replacement: the existing solver, actor identity and world coordinates
   are retained. Fitted equipment and connected envelopes replace toy-like bulbs. */
export function drawAthlete(r,p,time,phase){
 const wasActor=r.actorPass;r.actorPass=true;
 try {
  const k=kit[p.team],q=samplePose(p),build=q.build,skin=skinTones[p.index%skinTones.length];
  const height=build.height*(.99+(p.index%3)*.01);
  let root=mul(mul(translate(p.x,.15*q.fall,p.z),ry(p.heading||0)),rx(q.fall*1.38));
  root=mul(root,scale(build.width,height,1));
  const material=color=>color===skin?3:(color===k.jersey||color===k.pants)?2:1;
  const ell=(base,x,y,z,sx,sy,sz,color,shine=0)=>r.add('sphere',mul(base,pose(x,y,z,sx,sy,sz)),color,'',false,shine,material(color));
  const box=(base,x,y,z,sx,sy,sz,color)=>r.add('cube',mul(base,pose(x,y,z,sx,sy,sz)),color,'',false,0,material(color));
  const bone=(base,a,b,radius,color)=>r.add('limb',mul(base,segment(a,b,radius)),color,'',false,0,material(color));
  const tube=(base,a,b,radius,color)=>r.add('cylinder',mul(base,segment(a,b,radius)),color,'',false,.12,material(color));
  const torso=torsoFrame(q),chest=mul(root,torso);
  ell(root,0,q.pelvis-.018,0,.207,.135,.153,k.pants);
  r.add('torso',mul(chest,pose(0,.295,0,.285,.58,.172)),k.jersey,'',false,0,2);
  box(chest,0,.009,0,.398,.018,.286,dark);
  // Neck opening follows the sloped jersey shoulder, with no round pad caps.
  ell(chest,0,.584,0,.088,.025,.083,dark);
  ell(chest,0,.637,.003,.075,.078,.074,skin);
  for(const side of[-1,1]){
   tube(chest,[side*.212,.065,-.033],[side*.263,.31,-.029],.0045,k.trim);
  }
  // A fitted, open-face helmet over an actual jaw/cheek/nose surface.
  const head=mul(mul(mul(chest,translate(0,.79,.012)),rx(-q.lean*.80)),scale(.90));
  r.add('playerFace',mul(head,pose(0,-.008,.013,.129*(1+(p.index%3-1)*.025),.176,.139)),skin,'',false,0,3);
  r.add('helmet',mul(head,scale(.178,.203,.204)),k.helmet,'',false,.65,1);
  for(const side of[-1,1]){
   ell(head,side*.173,-.052,-.004,.011,.025,.022,dark);
   tube(head,[side*.157,-.061,.092],[side*.060,-.174,.154],.0085,white);
   box(head,side*.145,.075,-.04,.011,.018,.040,dark);
   // Small eyes and brow shadows sit in the sculpted sockets, not a face sticker.
   ell(head,side*.045,.011,.145,.018,.006,.005,white);
   ell(head,side*.045,.011,.150,.007,.006,.003,dark);
   tube(head,[side*.063,.030,.143],[side*.025,.030,.148],.0045,dark);
  }
  for(let j=0;j<12;j++){
   const a=-1.57+j*.197,b=a+.205;
   tube(head,[0,Math.cos(a)*.208,Math.sin(a)*.211],[0,Math.cos(b)*.208,Math.sin(b)*.211],.0075,p.team?white:k.jersey);
  }
  box(head,0,-.094,-.171,.166,.029,.013,white);
  ell(head,0,-.182,.152,.060,.028,.036,white);
  // Curved coated-steel facemask bars, not a rectangular box over the face.
  for(const [y,z]of[[-.044,.249],[-.128,.263]]){
   for(let i=0;i<8;i++){
    const a=-1+i*.25,b=a+.25;
    tube(head,[a*.143,y,z-.033*a*a],[b*.143,y,z-.033*b*b],.007,dark);
   }
  }
  for(const side of[-1,1]){
   tube(head,[side*.165,-.031,.119],[side*.143,-.044,.216],.007,dark);
   tube(head,[side*.143,-.044,.216],[side*.143,-.128,.230],.007,dark);
   tube(head,[side*.143,-.128,.230],[side*.126,-.164,.214],.007,dark);
  }
  if(p.role==='OL'||p.role==='DL')for(const x of[-.055,.055])tube(head,[x,-.044,.244],[x,-.128,.258],.007,dark);
  if(['WR','RB','DB'].includes(p.role))r.add('playerVisor',head,visor,'',false,.70,1);
  // Transparent stitched-number decals: no rectangular cloth cards on the torso.
  const jersey='jersey-'+p.team+'-'+p.number;
  r.add('plane',mul(mul(chest,translate(0,.318,-.181)),mul(rx(Math.PI/2),scale(-.33,-1,.31))),[1,1,1,1],jersey,false,0,2);
  r.add('plane',mul(mul(chest,translate(0,.318,.181)),mul(rx(-Math.PI/2),scale(.33,-1,-.31))),[1,1,1,1],jersey,false,0,2);
  for(const side of[-1,1]){
   const foot=footTarget(q,side),hip=[side*.141,q.pelvis,0],leg=twoBone(hip,foot,.50,.50,[0,0,1]);
   const thigh=build.leg*.88,armRadius=build.arm*.81;
   bone(root,hip,leg.joint,thigh,k.pants);
   ell(root,...leg.joint,thigh*.62,.064,thigh*.69,k.pants);
   const hem=mixPoint(leg.joint,leg.end,.22);
   bone(root,leg.joint,hem,thigh*.70,k.pants);
   // Football pants finish below the kneecap; fitted socks reveal the calf taper.
   bone(root,mixPoint(leg.joint,leg.end,.18),leg.end,thigh*.60,white);
   const stripeA=hip.map((v,i)=>v+(i===0?side*thigh*.88:0));
   const stripeB=leg.joint.map((v,i)=>v+(i===0?side*thigh*.66:0));
   tube(root,stripeA,stripeB,.007,k.trim);
   const ankle=leg.end;
   r.add('playerCleat',mul(root,pose(ankle[0],ankle[1]-.070,ankle[2]+.043,.080,.095,.145)),dark,'',false,.06,1);
   box(root,ankle[0],Math.max(.010,ankle[1]-.064),ankle[2]+.055,.139,.013,.247,dark);
   for(let i=0;i<4;i++)box(root,ankle[0],ankle[1]+.002-i*.004,ankle[2]+.03+i*.018,.052,.004,.007,white);
   box(root,ankle[0]+side*.069,ankle[1]-.026,ankle[2]+.035,.008,.022,.060,k.trim);
   const arm=resolveArm(p,q,side,phase,torso);
   // Sleeves bridge continuously from the shoulder to the exposed upper arm.
   const sleeveEnd=mixPoint(arm.start,arm.joint,.48);
   bone(root,arm.start,sleeveEnd,armRadius*1.22,k.jersey);
   bone(root,mixPoint(arm.start,arm.joint,.40),arm.joint,armRadius,skin);
   ell(root,...arm.joint,armRadius*.66,armRadius*.70,armRadius*.70,skin);
   const wrist=mixPoint(arm.joint,arm.end,.84);
   bone(root,arm.joint,wrist,armRadius*.74,p.index%4===0?dark:skin);
   bone(root,mixPoint(arm.joint,arm.end,.76),wrist,armRadius*.53,white);
   // Palm, four curled fingers and a separate thumb instead of a wrist disk.
   const len=Math.max(.001,Math.hypot(...arm.end.map((v,i)=>v-wrist[i])));
   const hand=segment(wrist,arm.end,1);for(let i=4;i<7;i++)hand[i]/=len;
   hand[12]=wrist[0];hand[13]=wrist[1];hand[14]=wrist[2];const hm=mul(root,hand),glove=p.role==='QB'?skin:white;
   ell(hm,0,.025,.004,.036,.033,.021,glove);
   for(let finger=0;finger<4;finger++){
    const x=(finger-1.5)*.018,length=[.032,.045,.048,.038][finger];
    bone(hm,[x,.043,.003],[x,.043+length*.65,.014],.009,glove);
    bone(hm,[x,.043+length*.65,.014],[x,.043+length,.032],.008,glove);
   }
   bone(hm,[side*.028,.009,.002],[side*.049,.027,.019],.012,glove);
   bone(hm,[side*.049,.027,.019],[side*.040,.044,.032],.010,glove);
  }
  if(p.hasBall){
   const qb=p.role==='QB';const ballM=mul(chest,mul(translate(qb?0:.184,qb?.21:.16,qb?.305:.23),rz(qb?1.15:-.28)));
   ell(ballM,0,0,0,.091,.188,.088,leather);box(ballM,0,0,.088,.017,.117,.006,white);
   for(let i=-2;i<=2;i++)box(ballM,0,i*.020,.092,.047,.006,.005,white);
  }
 } finally {r.actorPass=wasActor;}
}
