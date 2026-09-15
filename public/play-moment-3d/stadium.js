import{pose,mul,rx,rz,translate,scale,segment,hex}from'./renderer.js';
const C=hex;
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return[c,c.getContext('2d')]}
let seed=31;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
export function makeStadium(r){
 const staticParts=[],lamps=[],add=(...args)=>staticParts.push(args);
 seed=31;
 const [t,ctx]=canvas(1024,2048),W=1024,H=2048;
 ctx.fillStyle='#365f35';ctx.fillRect(0,0,W,H);
 for(let i=0;i<24;i++){ctx.fillStyle=i%2?'#30562e':'#365e32';ctx.fillRect(0,i*H/24,W,H/24)}
 for(let i=0;i<95000;i++){const k=Math.floor(random()*30+45);ctx.fillStyle=`rgba(${k},${k+30},${k-5},.19)`;ctx.fillRect(random()*W,random()*H,1+random()*2,1+random()*4)}
 const px=x=>(x+26.6667)/53.3334*W,py=z=>z/120*H;
 ctx.fillStyle='#162a32';ctx.fillRect(0,0,W,py(10));ctx.fillRect(0,py(110),W,py(10));
 ctx.strokeStyle='#e5e3d6';ctx.lineWidth=2.3;ctx.strokeRect(3,3,W-6,H-6);
 for(let y=10;y<=110;y+=5){ctx.beginPath();ctx.moveTo(0,py(y));ctx.lineTo(W,py(y));ctx.stroke()}
 for(let z=11;z<110;z++)for(const x of[-25.6,-3.1,3.1,25.6]){ctx.beginPath();ctx.moveTo(px(x)-5,py(z));ctx.lineTo(px(x)+5,py(z));ctx.lineWidth=1.9;ctx.stroke()}
 for(let z=20;z<=100;z+=10){const n=z<=60?z-10:110-z;for(const x of[-21.2,21.2]){ctx.save();ctx.translate(px(x),py(z));ctx.rotate(x<0?-Math.PI/2:Math.PI/2);ctx.font='900 42px Arial';ctx.textAlign='center';ctx.fillStyle='#e2e1cc';ctx.fillText(String(n),0,15);ctx.restore()}}
 ctx.fillStyle='#cbb475';ctx.textAlign='center';ctx.font='900 84px system-ui';ctx.fillText('KNOWERS',W/2,py(6.5));ctx.save();ctx.translate(W/2,py(114));ctx.rotate(Math.PI);ctx.fillText('BALL KNOWER',0,0);ctx.restore();
 ctx.save();ctx.translate(W/2,py(60));ctx.rotate(Math.PI/2);ctx.fillStyle='#172d32bb';ctx.font='italic 950 150px system-ui';ctx.fillText('BK',0,50);ctx.restore();r.texture('turf',t);
 const [b,bc]=canvas(1024,128);bc.fillStyle='#0c1925';bc.fillRect(0,0,1024,128);bc.fillStyle='#d9c284';bc.font='900 49px system-ui';bc.textAlign='center';bc.fillText('BALL KNOWER',512,70);bc.font='700 14px system-ui';bc.letterSpacing='4px';bc.fillStyle='#adbcca';bc.fillText('BUILD YOUR LEGACY',512,103);r.texture('banner',b);
 const [glow,gc]=canvas(128,128),halo=gc.createRadialGradient(64,64,0,64,64,64);
 halo.addColorStop(0,'rgba(230,242,255,.9)');halo.addColorStop(.12,'rgba(198,220,255,.5)');halo.addColorStop(.38,'rgba(152,191,244,.12)');halo.addColorStop(1,'rgba(100,160,255,0)');gc.fillStyle=halo;gc.fillRect(0,0,128,128);r.texture('lamp-glow',glow);
 const [sh,sc]=canvas(64,64),g=sc.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(0,0,0,.55)');g.addColorStop(.3,'rgba(0,0,0,.38)');g.addColorStop(1,'rgba(0,0,0,0)');sc.fillStyle=g;sc.fillRect(0,0,64,64);r.texture('shadow',sh);
 add('cube',pose(0,-.22,60,88,.4,148),C('#222e31'));
 add('plane',pose(0,.01,60,53.333,1,120),[1,1,1,1],'turf');
 // Concrete bowl and continuous seating tiers. Spectators are cheap instances.
 for(const side of[-1,1]){
  add('cube',pose(side*31,.85,60,2,1.7,130),C('#1b2935'));
  for(let row=0;row<13;row++){
   const x=side*(33+row*.95),y=1.5+row*.74;
   add('cube',pose(x,y-.27,60,1.25,.58,135),C(row%3===0?'#243442':'#182632'));
   for(let k=0;k<95;k++){
    const z=-5+k*1.4+(row%2)*.6,v=random(),cl=v<.48?'#b8b6ab':v<.68?'#172c46':v<.85?'#bd945c':'#723c37';
    add('cube',pose(x,y+.25,z,.37,.57,.43),C(cl));add('crowd',pose(x,y+.66,z,.145,.17,.14),C(random()<.45?'#b88a65':'#7c563c'));
   }
  }
  add('cube',pose(side*46,12,60,2,2,140),C('#142330'));
  for(let z=10;z<120;z+=22){let m=mul(translate(side*31.9,1.08,z),mul(rz(side*Math.PI/2),scale(1.45,1,14)));add('plane',m,[1,1,1,1],'banner',true)}
  // Sideline benches and practice staff silhouettes, outside the playing field.
  for(let z=34;z<90;z+=8){add('cube',pose(side*28.6,.55,z,.65,.18,3.3),C('#d1d6d7'));add('cube',pose(side*29,.9,z,.2,.65,3.3),C('#969fa5'))}
 }
 for(const end of[-5,125]){
  for(let j=0;j<7;j++)add('cube',pose(0,1+j*.8,end+(end<0?-j:j),67,1,1.1),C('#243746'));
  for(let row=0;row<5;row++)for(let x=-31;x<32;x+=1.35){add('cube',pose(x,1.7+row*.8,end+(end<0?-row:row),.45,.65,.45),C(random()<.5?'#a8aba9':'#263948'))}
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
 return{draw(){for(const p of staticParts)r.add(...p);for(const pos of lamps)r.glow(pos,10,[.60,.76,1,.27]);},parts:staticParts.length};
}
