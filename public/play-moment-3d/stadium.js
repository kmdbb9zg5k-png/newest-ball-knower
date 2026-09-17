import{pose,mul,rx,rz,translate,scale,segment,hex}from'./renderer.js';
import{installNightStadium}from'./night-stadium.js';
const C=hex;
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return[c,c.getContext('2d')]}
let seed=31;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
export function makeStadium(r){
 const staticParts=[],lamps=[],add=(...args)=>staticParts.push(args);
 seed=31;
 const [t,ctx]=canvas(1024,2048),W=1024,H=2048;
 const px=x=>(x+26.6667)/53.3334*W,py=z=>z/120*H;
 const base=ctx.createLinearGradient(0,0,W,0);base.addColorStop(0,'#24472b');base.addColorStop(.5,'#315e34');base.addColorStop(1,'#214228');ctx.fillStyle=base;ctx.fillRect(0,0,W,H);
 for(let i=0;i<24;i++){ctx.fillStyle=i%2?'rgba(10,45,17,.14)':'rgba(102,146,74,.08)';ctx.fillRect(0,i*H/24,W,H/24)}
 for(let i=0;i<18000;i++){const bright=random()>.46,k=Math.floor(random()*24+38);ctx.fillStyle=bright?`rgba(${k},${k+38},${k-4},.16)`:`rgba(9,28,12,.11)`;ctx.fillRect(random()*W,random()*H,.6+random()*1.4,1+random()*5)}
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
 add('cube',pose(0,-.22,60,88,.4,148),C('#222e31'));
 add('plane',pose(0,.01,60,53.333,1,120),[1,1,1,1],'turf');
 for(const x of[-16,16])for(const z of[31,89])add('plane',pose(x,.018,z,30,1,24),[1,1,1,.75],'stadium-pool',true);
 // Concrete bowl and continuous seating tiers. Spectators are cheap instances.
 for(const side of[-1,1]){
  add('cube',pose(side*31,.85,60,2,1.7,130),C('#1b2935'));
  for(let row=0;row<13;row++){
   const x=side*(33+row*.95),y=1.5+row*.74;
   add('cube',pose(x,y-.27,60,1.25,.58,135),C(row%3===0?'#243442':'#182632'));
   for(let k=0;k<95;k++){
    if(k%18===8||k%18===9)continue;const z=-5+k*1.4+(row%2)*.6,v=random(),cl=v<.42?'#c5c2b5':v<.66?'#142e4d':v<.86?'#c29a57':'#7b4140',body=.25+random()*.055;
    add('crowd',pose(x,y+.27,z,body,.40+random()*.07,body*.92),C(cl));add('crowd',pose(x,y+.67,z,.135,.16,.13),C(random()<.45?'#b88a65':'#7c563c'));
   }
  }
  add('cube',pose(side*46,12,60,2,2,140),C('#142330'));
  for(let z=10;z<120;z+=22){let m=mul(translate(side*31.9,1.08,z),mul(rz(side*Math.PI/2),scale(1.45,1,14)));add('plane',m,[1,1,1,1],'banner',true)}
  // Sideline benches and practice staff silhouettes, outside the playing field.
  for(let z=34;z<90;z+=8){add('cube',pose(side*28.6,.55,z,.65,.18,3.3),C('#d1d6d7'));add('cube',pose(side*29,.9,z,.2,.65,3.3),C('#969fa5'))}
  for(let z=29;z<=94;z+=5){const jersey=(Math.round(z/5)+side)%3===0?'#c8ccd0':side<0?'#132e4c':'#8e302c';add('cylinder',segment([side*28.1,.08,z],[side*28.1,1.3,z],.20),C(jersey));add('sphere',pose(side*28.1,1.56,z,.22,.24,.22),C('#9a6e50'));}
 }
 for(const end of[-5,125]){
  for(let j=0;j<7;j++)add('cube',pose(0,1+j*.8,end+(end<0?-j:j),67,1,1.1),C('#243746'));
  for(let row=0;row<5;row++)for(let x=-31,seat=0;x<32;x+=1.35,seat++){const z=end+(end<0?-row:row),occupied=seat%17!==8&&seat%17!==9&&random()>.13;add('cube',pose(x,1.7+row*.8,z,.45,.65,.45),C(occupied?'#263948':'#354754'));if(occupied){const v=random(),shirt=v<.38?'#c7c5b9':v<.62?'#17324d':v<.82?'#bd9554':'#814541';add('crowdEnd',pose(x,2.05+row*.8,z+(end<0?.22:-.22),.25,.38,.23),C(shirt));add('crowdEnd',pose(x,2.45+row*.8,z+(end<0?.22:-.22),.13,.15,.13),C(random()<.48?'#b88664':'#7d573f'))}}
 }
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
 return{draw(){for(const p of staticParts)r.add(...p);for(const pos of lamps)r.glow(pos,10,[.60,.76,1,.27]);},parts:staticParts.length};
}
