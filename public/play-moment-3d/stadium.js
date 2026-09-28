import{stadiumCorners,stadiumDetails}from'./stadium-architecture.js?v=stadium-finish-36';
import{installSceneMaterials}from'./scene-materials.js?v=reference-scene-31';
import{pose,mul,rx,rz,translate,scale,segment,hex}from'./renderer.js?v=stadium-finish-36';
import{installNightStadium}from'./night-stadium.js';
const C=hex;
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return[c,c.getContext('2d')]}
let seed=31;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
export function makeStadium(r){
 const art=installSceneMaterials(r),fans=[],staffSprites=[],staffFallback=[],crowdFallback=[],staticParts=[],lamps=[];let crowdGeometry=false;const add=(...args)=>(crowdGeometry?crowdFallback:staticParts).push(args);
 seed=31;
 const turfScale=Math.min(2,(r.gl?.getParameter?.(r.gl.MAX_TEXTURE_SIZE)||4096)/2048);
 const [t,ctx]=canvas(1024*turfScale,2048*turfScale),W=1024,H=2048;ctx.scale(turfScale,turfScale);
 const px=x=>(x+26.6667)/53.3334*W,py=z=>z/120*H;
 const base=ctx.createLinearGradient(0,0,W,0);base.addColorStop(0,'#22482c');base.addColorStop(.5,'#35673c');base.addColorStop(1,'#21452b');ctx.fillStyle=base;ctx.fillRect(0,0,W,H);
 for(let i=0;i<24;i++){ctx.fillStyle=i%2?'rgba(10,45,17,.14)':'rgba(102,146,74,.08)';ctx.fillRect(0,i*H/24,W,H/24)}
 for(let i=0;i<30000;i++){const bright=random()>.46,k=Math.floor(random()*24+38);ctx.fillStyle=bright?`rgba(${k},${k+38},${k-4},.16)`:`rgba(9,28,12,.11)`;ctx.fillRect(random()*W,random()*H,.6+random()*1.4,1+random()*2.1)}
 for(let i=0;i<820;i++){const z=py(12+random()*96),x=px((random()-.5)*14),radius=3+random()*15,wear=ctx.createRadialGradient(x,z,0,x,z,radius);wear.addColorStop(0,'rgba(156,145,91,.025)');wear.addColorStop(1,'rgba(156,145,91,0)');ctx.fillStyle=wear;ctx.fillRect(x-radius,z-radius,radius*2,radius*2)}
 for(const [a,b]of[[0,10],[110,120]]){const end=ctx.createLinearGradient(0,py(a),0,py(b));end.addColorStop(0,'#10252f');end.addColorStop(.55,'#17333c');end.addColorStop(1,'#0b1b25');ctx.fillStyle=end;ctx.fillRect(0,py(a),W,py(b-a))}
 ctx.strokeStyle='#eeeadd';ctx.lineCap='round';ctx.lineWidth=3.1;ctx.strokeRect(4,4,W-8,H-8);
 for(let y=10;y<=110;y+=5){ctx.globalAlpha=y%10===0?1:.72;ctx.lineWidth=y%10===0?3.2:2.1;ctx.beginPath();ctx.moveTo(0,py(y));ctx.lineTo(W,py(y));ctx.stroke()}
 ctx.globalAlpha=1;
 for(let z=11;z<110;z++)for(const x of[-25.6,-3.1,3.1,25.6]){ctx.beginPath();ctx.moveTo(px(x)-5.5,py(z));ctx.lineTo(px(x)+5.5,py(z));ctx.lineWidth=z%5===0?2.2:1.65;ctx.stroke()}
 ctx.strokeStyle='#cdb16b';ctx.lineWidth=4;for(const z of[10,110]){ctx.beginPath();ctx.moveTo(0,py(z));ctx.lineTo(W,py(z));ctx.stroke()}
 for(let z=20;z<=100;z+=10){const n=z<=60?z-10:110-z;for(const x of[-21.2,21.2]){ctx.save();ctx.translate(px(x),py(z));ctx.rotate(x<0?-Math.PI/2:Math.PI/2);ctx.font='900 42px Arial';ctx.textAlign='center';ctx.fillStyle='#e2e1cc';ctx.fillText(String(n),0,15);ctx.restore()}}
 ctx.fillStyle='#d9bc74';ctx.textAlign='center';ctx.shadowColor='rgba(0,0,0,.35)';ctx.shadowBlur=6;ctx.font='italic 950 84px system-ui';ctx.fillText('KNOWERS',W/2,py(6.5));ctx.save();ctx.translate(W/2,py(114));ctx.rotate(Math.PI);ctx.fillText('BALL KNOWER',0,0);ctx.restore();ctx.shadowBlur=0;
 ctx.save();ctx.translate(W/2,py(60));ctx.rotate(Math.PI/2);ctx.beginPath();ctx.moveTo(-92,-73);ctx.lineTo(76,-73);ctx.lineTo(112,0);ctx.lineTo(76,73);ctx.lineTo(-92,73);ctx.lineTo(-116,0);ctx.closePath();ctx.fillStyle='#102a36d9';ctx.fill();ctx.lineWidth=9;ctx.strokeStyle='#cbb06b';ctx.stroke();ctx.font='italic 950 104px system-ui';ctx.fillStyle='#eef0e7';ctx.fillText('BK',-2,35);ctx.restore();r.texture('turf',t);
 const [b,bc]=canvas(1024,128);bc.fillStyle='#0c1925';bc.fillRect(0,0,1024,128);bc.fillStyle='#d9c284';bc.font='900 49px system-ui';bc.textAlign='center';bc.fillText('BALL KNOWER',512,70);bc.font='700 14px system-ui';bc.letterSpacing='4px';bc.fillStyle='#adbcca';bc.fillText('BUILD YOUR LEGACY',512,103);r.texture('banner',b);
 const [glow,gc]=canvas(128,128),halo=gc.createRadialGradient(64,64,0,64,64,64);
 halo.addColorStop(0,'rgba(230,242,255,.9)');halo.addColorStop(.12,'rgba(198,220,255,.5)');halo.addColorStop(.38,'rgba(152,191,244,.12)');halo.addColorStop(1,'rgba(100,160,255,0)');gc.fillStyle=halo;gc.fillRect(0,0,128,128);r.texture('lamp-glow',glow);
 const [sh,sc]=canvas(64,64),g=sc.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(0,0,0,.55)');g.addColorStop(.3,'rgba(0,0,0,.38)');g.addColorStop(1,'rgba(0,0,0,0)');sc.fillStyle=g;sc.fillRect(0,0,64,64);r.texture('shadow',sh);
 const [focus,fc]=canvas(128,128),focusGlow=fc.createRadialGradient(64,64,3,64,64,64);focusGlow.addColorStop(0,'rgba(255,223,129,.38)');focusGlow.addColorStop(.34,'rgba(225,188,91,.16)');focusGlow.addColorStop(1,'rgba(204,165,68,0)');fc.fillStyle=focusGlow;fc.fillRect(0,0,128,128);r.texture('player-glow',focus);
 const [dust,dc]=canvas(96,96),dustGlow=dc.createRadialGradient(48,48,2,48,48,46);dustGlow.addColorStop(0,'rgba(255,247,210,.82)');dustGlow.addColorStop(.26,'rgba(196,166,103,.48)');dustGlow.addColorStop(1,'rgba(124,96,54,0)');dc.fillStyle=dustGlow;dc.fillRect(0,0,96,96);for(let i=0;i<28;i++){dc.fillStyle=`rgba(255,239,190,${.12+random()*.28})`;dc.beginPath();dc.arc(18+random()*60,18+random()*60,.7+random()*2.2,0,Math.PI*2);dc.fill()}r.texture('turf-fx',dust);
 const [impact,ic]=canvas(128,128),impactGlow=ic.createRadialGradient(64,64,0,64,64,64);impactGlow.addColorStop(0,'rgba(255,244,187,.86)');impactGlow.addColorStop(.14,'rgba(255,199,78,.46)');impactGlow.addColorStop(.42,'rgba(243,132,40,.12)');impactGlow.addColorStop(1,'rgba(225,102,26,0)');ic.fillStyle=impactGlow;ic.fillRect(0,0,128,128);r.texture('impact-glow',impact);
 const [pool,pc]=canvas(128,128),poolGlow=pc.createRadialGradient(64,64,1,64,64,64);poolGlow.addColorStop(0,'rgba(224,238,242,.24)');poolGlow.addColorStop(.45,'rgba(176,207,220,.095)');poolGlow.addColorStop(1,'rgba(115,160,184,0)');pc.fillStyle=poolGlow;pc.fillRect(0,0,128,128);r.texture('stadium-pool',pool);
 const [ribbon,rc]=canvas(128,2048),ribbonGradient=rc.createLinearGradient(0,0,128,0);ribbonGradient.addColorStop(0,'#07111a');ribbonGradient.addColorStop(.48,'#233843');ribbonGradient.addColorStop(1,'#07111a');rc.fillStyle=ribbonGradient;rc.fillRect(0,0,128,2048);for(let y=0;y<2048;y+=128){const hot=(y/128)%3===0;rc.fillStyle=hot?'#d7b966':'#6f93a7';rc.fillRect(18,y+16,92,5);rc.fillStyle=hot?'#745e2f':'#263f51';rc.fillRect(30,y+34,68,44);rc.fillStyle='#e8edf0';for(let x=37;x<93;x+=14)rc.fillRect(x,y+46,5,18);rc.fillStyle='#0b151e';rc.fillRect(18,y+96,92,3)}r.texture('led-ribbon',ribbon);
 add('cube',pose(0,-.22,60,88,.4,148),C('#222e31'));
 add('plane',pose(0,.01,60,53.333,1,120),[1,1,1,1],'turf');
 // The turf receives the scene lights directly; no pale light-pool decals.
 // Concrete bowl and continuous seating tiers. Spectators are cheap instances.
 for(const side of[-1,1]){
  add('cube',pose(side*31,.85,60,2,1.7,130),C('#1b2935'));
  for(let row=0;row<13;row++){
   const x=side*(33+row*.95),y=1.5+row*.74;
   add('cube',pose(x,y-.27,60,1.25,.58,120),C(row%3===0?'#243442':'#182632'));
   for(let k=0;k<125;k++){
    if(k%18===8||k%18===9)continue;const z=k*.96+(row%2)*.43,v=random(),cl=v<.19?'#a6adb0':v<.60?'#18344a':v<.78?'#856d47':v<.91?'#543435':'#3a4651',body=.25+random()*.055;
    crowdGeometry=true;fans.push([x,y-.12,z,1.40+random()*.26,1.64+random()*.20,Math.floor(random()*16),.84+random()*.23]);add('crowd',pose(x,y+.27,z,body,.75+random()*.06,body*.92),C(cl));add('crowdHead',pose(x,y+.68,z,.12,.15,.12),C(random()<.45?'#b88a65':'#7c563c'));if(k%13===row%13){for(const sign of[-1,1])add('cylinder',segment([x,y+.42,z+sign*.21],[x-side*.12,y+.88,z+sign*.38],.048),C(cl));}crowdGeometry=false;
   }
  }
  add('cube',pose(side*46,12,60,2,2,140),C('#142330'));
  for(let z=10;z<120;z+=22){let m=mul(translate(side*31.9,1.08,z),mul(rz(side*Math.PI/2),scale(1.45,1,14)));add('plane',m,[1,1,1,1],'banner',true)}
  // Crisp sideline border and floodlight banks outside the regulation field.
  add('plane',pose(side*27.2,.014,60,.44,1,120),C('#d5d5ca'));
  for(const z of[22,62,102]){
   const x=side*40.5;
   add('cube',pose(x,16.5,z,.45,.8,4.0),C('#202c34'));
   for(let k=0;k<6;k++)add('cube',pose(x-side*.26,16.5,z-1.65+k*.66,.045,.55,.43),C('#f3ecdb'),'',true);
   lamps.push([x-side*.35,16.5,z]);
  }
  // Sideline benches and practice staff silhouettes, outside the playing field.
  for(let z=34;z<90;z+=8){add('cube',pose(side*28.6,.55,z,.65,.18,3.3),C('#77858b'));add('cube',pose(side*29,.9,z,.2,.65,3.3),C('#3c4b53'))}
  const staffStart=staticParts.length;
  for(let z=25;z<=97;z+=3){
   const x=side*(28.1+random()*.42),staff=Math.round(z/5)%3===0,jersey=staff?'#8b9498':side<0?'#18394e':'#a13d39',skin=random()<.5?'#aa7957':'#68452f';
   staffSprites.push([x,-.035,z,2.15+random()*.13,staff?12+Math.floor(random()*4):side<0?Math.floor(random()*8):8+Math.floor(random()*4)]);add('crowd',pose(x,1.21,z,.25,.59,.25),C(jersey),'',false,.02,2);
   add('sphere',pose(x,1.72,z,.13,.17,.14),C(skin),'',false,.02,3);
   if(!staff)add('sphere',pose(x,1.78,z,.155,.15,.16),C(side<0?'#d8dee1':'#8e3033'),'',false,.38,1);
   for(const sign of[-1,1]){
    const hip=[x,1.01,z+sign*.11],knee=[x-side*.035,.54,z+sign*.135],foot=[x-side*.075,.10,z+sign*.15];
    add('cylinder',segment(hip,knee,.092),C(staff?'#202e39':jersey),'',false,0,2);
    add('cylinder',segment(knee,foot,.065),C(staff?'#202e39':'#b7c0c3'),'',false,0,2);
    add('sphere',pose(foot[0]-side*.05,.07,foot[2],.15,.07,.082),C('#151f29'));
    const shoulder=[x,1.44,z+sign*.24],elbow=[x-side*.06,1.15,z+sign*.29],hand=[x-side*(staff?.28:.08),staff?1.2:.97,z+sign*.18];
    add('cylinder',segment(shoulder,elbow,.066),C(jersey),'',false,0,2);add('cylinder',segment(elbow,hand,.045),C(skin),'',false,0,3);add('sphere',pose(...hand,.05),C(skin));
   }
   if(staff){add('cube',pose(x-side*.27,1.18,z,.035,.23,.31),C('#c3b390'));add('cylinder',segment([x,1.84,z-.08],[x-side*.20,1.82,z-.08],.025),C('#162330'));}
  }
  staffFallback.push(...staticParts.splice(staffStart));
 }
 // Continuous end-zone stands: close the empty gap behind the goal posts.
 // Shared atlas instances keep the fuller bowl in one crowd draw call.
 for(const end of[-6,126]){
  const direction=end<0?-1:1;
  for(let row=0;row<14;row++){
   const y=1.5+row*.74,z=end+direction*row*.95;
   add('cube',pose(0,y-.27,z,54,.58,1.15),C(row%3===0?'#26333b':'#18242e'));
   for(let seat=0;seat<59;seat++){
    const x=-26.5+seat*.91+(row%2)*.20;
    if(Math.abs(x)<.7||Math.abs(Math.abs(x)-18.4)<.7||Math.abs(x)<4.1&&row<4)continue;
    const v=random(),shirt=v<.24?'#b4a178':v<.63?'#253c50':v<.81?'#b4b8b7':'#544047';
    crowdGeometry=true;
    fans.push([x,y+.12,z,1.32+random()*.14,1.65+random()*.17,Math.floor(random()*16),.87+random()*.23]);
    add('crowdEnd',pose(x,y+.70,z,.28,.78,.25),C(shirt));
    add('crowdHead',pose(x,y+1.10,z,.12,.15,.12),C(random()<.48?'#b88664':'#7d573f'));
    crowdGeometry=false;
   }
  }
  // A warm concourse and lit roof edge give the night scene a visible horizon.
  const rear=end+direction*15.4;
  add('cube',pose(0,13.6,rear,83,3.6,2),C('#122333'));
  add('cube',pose(0,15.7,rear,86,.42,5),C('#1c303c'));
  add('cube',pose(0,11.75,rear-direction*1.05,82,.24,.10),C('#d0b475'),'',true);
  for(let x=-38;x<=38;x+=4){
   add('cube',pose(x,13.5,rear-direction*1.06,2.9,1.65,.08),C('#645b47'),'',true);
   add('cube',pose(x,13.5,rear-direction*1.12,.08,1.75,.12),C('#1e2b35'));
  }
  for(const x of[-31,31])lamps.push([x,15.45,rear-direction*2.6]);
 }
 stadiumCorners(add,(x,y,z,row,seat)=>{
  const v=random(),shirt=v<.3?'#b5a67a':v<.72?'#243d53':'#aaaca5';
  fans.push([x,y,z,1.24+random()*.20,1.60+random()*.20,Math.floor(random()*16),.80+random()*.25]);
  crowdGeometry=true;add('crowdEnd',pose(x,y+.48,z,.26,.76,.24),C(shirt));add('crowdHead',pose(x,y+.88,z,.12,.15,.12),C('#9c775a'));crowdGeometry=false;
 });
 stadiumDetails(add);
 // Per-instance pose reflection, spacing and brightness break the repeated grid.
 for(const fan of fans){fan[0]+=(random()-.5)*.13;fan[2]+=(random()-.5)*.13;fan[5]+=random()>.5?.25:0;fan[6]*=.92+random()*.16;}
 // Goal posts, with actual vertical scale.
 for(const z of[3,117]){
  add('cylinder',segment([0,0,z],[0,3.2,z],.13),C('#d1b254'));add('cylinder',segment([-3.1,3.2,z],[3.1,3.2,z],.09),C('#ead57a'));
  for(const x of[-3.1,3.1])add('cylinder',segment([x,3.2,z],[x,10,z],.07),C('#ead57a'));
 }
 // Floodlight pylons and white lamp banks.
 for(const x of[-35,35])for(const z of[6,111]){
  add('cylinder',segment([x,0,z],[x,23,z],.17),C('#546572'));
  add('cube',pose(x,23,z,5,1.8,.32),C('#3d515f'));lamps.push([x,23,z-.28]);
  for(let j=0;j<6;j++)add('cube',pose(x-2+j*.8,23,z-.2,.54,1.1,.08),C('#f6f3dd'),'',true);
 }
 // Upper-deck lights, ribbon boards and rails frame the field without a sky image.
 for(const side of[-1,1]){
  const ribbonMatrix=mul(translate(side*45.66,12.95,60),mul(rz(side*Math.PI/2),scale(.42,1,69)));add('plane',ribbonMatrix,[1,1,1,.96],'led-ribbon',true);
  add('cube',pose(side*46,11.8,60,.12,.14,139),C('#b18d4e'),'',true);
  add('cylinder',segment([side*30,1.9,-3],[side*30,1.9,123],.045),C('#86929b'));
  for(let z=0;z<=120;z+=4)add('cylinder',segment([side*30,.8,z],[side*30,1.9,z],.035),C('#68747e'));
 }
 for(const end of[-11,131]){
  const face=end<0?1:-1;
  add('cube',pose(0,7.3,end,70,.6,1),C('#101e2b'));
  add('cube',pose(0,7.63,end+face*.56,70,.045,.025),C('#d3b874'),'',true);
  for(const x of[-23,23]){
   add('cylinder',segment([x,5,end],[x,17,end],.11),C('#344454'));
   add('cube',pose(x,17,end,5.5,1.3,.6),C('#203141'));
   for(let k=0;k<8;k++)add('cube',pose(x-2.4+k*.68,17,end+face*.34,.46,.93,.045),C('#f3f5f0'),'',true);
   lamps.push([x,17,end+face*.4]);
  }
 }
 for(const x of[-26.4,26.4])for(const z of[10,110])add('cube',pose(x,.25,z,.20,.50,.20),C('#ef7943'));
 installNightStadium(r,add);
 return{draw(){for(const p of staticParts)r.add(...p);if(!art.crowd)for(const p of crowdFallback)r.add(...p);
  if(art.crowd)for(const [x,y,z,w,h,cell,shade]of fans)r.add('crowdSprite',pose(x,y,z,w,h,1),[shade,shade,shade,1],'crowd-atlas',false,cell,6);
  if(art.sideline)for(const [x,y,z,h,cell]of staffSprites){r.add('crowdSprite',pose(x,y,z,h,h,1),[1.1,1.1,1.1,1],'sideline-atlas',false,cell,6);r.add('plane',pose(x,.016,z,.7,1,.55),[1,1,1,.42],'shadow',true)}else for(const p of staffFallback)r.add(...p);
  for(const pos of lamps){r.glow(pos,8,[.64,.75,1,.19]);r.glow(pos,2.4,[1,.95,.80,.52]);}},parts:staticParts.length};
}
