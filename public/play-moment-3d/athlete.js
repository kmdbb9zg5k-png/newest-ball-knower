import{mul,translate,scale,rx,ry,rz,pose,segment,hex}from'./renderer.js';
const white=hex('#e7e9e5'),dark=hex('#101a23'),gold=hex('#d8b66e'),skinTones=['#a46d49','#633d2d','#ba8b66','#8b563b'];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const kit=[{jersey:hex('#19354d'),pants:hex('#20374a'),helmet:hex('#bba275'),trim:gold},{jersey:hex('#e8e9e1'),pants:hex('#afb5b8'),helmet:hex('#863d3b'),trim:hex('#8f4640')}];
export function prepareJerseys(renderer,actors){for(const p of actors){if(renderer.textures.has('jersey-'+p.team+'-'+p.number))continue;const c=document.createElement('canvas');c.width=128;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=p.team?'#e8e9e1':'#19354d';ctx.fillRect(0,0,128,128);ctx.fillStyle=p.team?'#863d3b':'#ece9dc';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 78px system-ui';ctx.fillText(String(p.number),64,66);renderer.texture('jersey-'+p.team+'-'+p.number,c)}}
/* Hierarchical articulated geometry with two-bone leg IK. Root movement comes
   from the simulation; the character is never bobbed as a flat image. */
export function drawAthlete(r,p,time,phase){
 const k=kit[p.team],large=p.role==='OL'||p.role==='DL',size=large?1.06:1,wide=large?1.14:1;
 let root=mul(translate(p.x,0,p.z),ry(p.heading||0));root=mul(root,scale(wide,size,1));
 if(p.fallen){root=mul(root,translate(0,.34,0));root=mul(root,rx(1.3))}
 const skin=hex(skinTones[p.index%skinTones.length]);
 const running=p.moving&&phase!=='pre'&&!p.fallen,blocking=(p.role==='OL'||p.engaged)&&phase!=='pre',ready=phase==='pre';
 const crouch=ready?(large?.22:.06):blocking?.16:0;
 const pelvisY=1.04-crouch,gait=(p.distance||0)*5.5;
 const chest=mul(mul(root,translate(0,pelvisY,0)),rx(ready?(large?.57:.25):running?.21:blocking?.36:0));
 const ell=(base,x,y,z,sx,sy,sz,color,shine=0)=>r.add('sphere',mul(base,pose(x,y,z,sx,sy,sz)),color,'',false,shine);
 const box=(base,x,y,z,sx,sy,sz,color)=>r.add('cube',mul(base,pose(x,y,z,sx,sy,sz)),color);
 ell(chest,0,.035,0,.225,.18,.155,k.pants);
 ell(chest,0,.26,0,.245,.30,.185,k.jersey);
 ell(chest,0,.44,.015,.34,.195,.205,k.jersey);
 box(chest,0,.09,0,.44,.042,.307,k.trim);
 ell(chest,0,.64,0,.088,.11,.09,skin);
 // Helmet with an actual face opening, ear protection, center stripe and facemask.
 const head=mul(chest,translate(0,.79,.012));
 ell(head,0,-.012,.025,.139,.17,.144,skin);
 r.add('helmet',mul(head,scale(.189,.215,.225)),k.helmet,'',false,.55);
 ell(head,-.177,-.025,0,.03,.087,.084,k.helmet,.3);ell(head,.177,-.025,0,.03,.087,.084,k.helmet,.3);
 // Stripe follows the crown instead of a flat logo sticker.
 for(let j=0;j<10;j++){const a=-1.7+j*.27,b=a+.29;const A=[0,Math.cos(a)*.217,Math.sin(a)*.227],B=[0,Math.cos(b)*.217,Math.sin(b)*.227];r.add('cylinder',mul(head,segment(A,B,.016)),p.team?white:k.jersey)}
 const bars=[[[ -.18,-.065,.16],[-.135,-.13,.30]],[[.18,-.065,.16],[.135,-.13,.30]],[[-.135,-.13,.30],[.135,-.13,.30]],[[-.15,-.055,.28],[.15,-.055,.28]],[[-.15,-.055,.28],[-.135,-.13,.30]],[[.15,-.055,.28],[.135,-.13,.30]],[[0,-.055,.28],[0,-.13,.30]]];
 for(const[a,b]of bars)r.add('cylinder',mul(head,segment(a,b,.012)),dark,'',false,.32);
 box(head,0,-.006,.176,.254,.058,.018,dark);
 // Jersey numbers front/back remain attached to the torso as it rotates.
 const jersey='jersey-'+p.team+'-'+p.number;
 r.add('plane',mul(mul(chest,translate(0,.36,-.19)),mul(rx(Math.PI/2),scale(.31,1,.30))),[1,1,1,1],jersey);
 r.add('plane',mul(mul(chest,translate(0,.36,.198)),mul(rx(-Math.PI/2),scale(.31,1,.30))),[1,1,1,1],jersey);
 for(const side of[-1,1]){
  const a=gait+(side===1?Math.PI:0),footZ=running?Math.sin(a)*.44:ready?.10:0,footY=running?Math.max(0,Math.cos(a))*.19+.09:.09;
  const dy=footY-pelvisY,dz=footZ,d=clamp(Math.hypot(dy,dz),.15,.995),L1=.51,L2=.49;
  const aim=Math.atan2(-dz,-dy),hipA=aim-Math.acos(clamp((L1*L1+d*d-L2*L2)/(2*L1*d),-1,1)),kneeA=Math.PI-Math.acos(clamp((L1*L1+L2*L2-d*d)/(2*L1*L2),-1,1));
  const thigh=mul(mul(root,translate(side*.15,pelvisY,0)),rx(hipA));
  ell(thigh,0,-.22,0,.123,.285,.126,k.pants);const shin=mul(mul(thigh,translate(0,-L1,0)),rx(kneeA));
  ell(shin,0,0,.035,.13,.105,.135,k.pants);ell(shin,0,-.21,0,.086,.265,.093,k.pants);
  ell(shin,0,-.34,0,.096,.105,.105,white);
  // Foot targets, not a vertical sprite animation, control the grounded stride.
  ell(root,side*.15,footY-.025,footZ+.075,.11,.071,.208,dark);
  box(root,side*.15,Math.max(.015,footY-.07),footZ+.07,.19,.034,.32,white);
  const shoulder=mul(chest,translate(side*.305,.45,0));
  let armA=running?Math.sin(a+Math.PI)*.83:ready?-.28:0,elbow=-.45;
  if(blocking){armA=-1.00;elbow=-.56}
  if(p.hasBall&&side===1){armA=-.57;elbow=-1.65}
  if(p.role==='QB'&&phase==='pass'){armA=-.55;elbow=-1.9}
  if(p.throwT>0&&side===1){armA=-2.8+p.throwT*1.8;elbow=-.9+p.throwT*.5}
  if(p.catchT>0){armA=-1.7;elbow=-.5}
  const upper=mul(shoulder,mul(rz(side*.08),rx(armA)));
  ell(upper,0,-.055,0,.14,.15,.15,k.jersey);
  ell(upper,0,-.14,0,.132,.03,.14,k.trim);
  ell(upper,0,-.25,0,.092,.18,.10,skin);
  const fore=mul(mul(upper,translate(0,-.36,0)),rx(elbow));
  ell(fore,0,-.14,0,.078,.17,.085,skin);ell(fore,0,-.265,0,.085,.045,.095,white);ell(fore,0,-.327,.006,.087,.10,.062,white);
 }
 if(p.hasBall){const ballM=mul(chest,mul(translate(.18,.19,.265),rz(-.25)));ell(ballM,0,0,0,.105,.21,.102,hex('#81482b'));box(ballM,0,0,.099,.025,.18,.009,white)}
}
