/** Authored upper bowl, continuous concourse and sideline equipment.
 * Reuses the existing instancing and crowd atlas. Never enters gameplay bounds.
 */
import {pose,segment,mul,translate,rz,scale,hex} from './renderer.js';

export function installRemodeledBowl(renderer,add,fans,random){
 const box=(x,y,z,sx,sy,sz,color,unlit=false)=>add('cube',pose(x,y,z,sx,sy,sz),hex(color),'',unlit);
 const beam=(a,b,r,color)=>add('cylinder',segment(a,b,r),hex(color));
 const c=document.createElement('canvas');c.width=256;c.height=2048;
 const ctx=c.getContext('2d');
 ctx.fillStyle='#0b1d2e';ctx.fillRect(0,0,256,2048);
 for(let y=0;y<2048;y+=256){
  ctx.fillStyle='#d7b570';ctx.fillRect(0,y,256,5);
  ctx.save();ctx.translate(128,y+128);ctx.rotate(Math.PI/2);
  ctx.fillStyle='#e2e8eb';ctx.font='italic 900 31px system-ui';ctx.textAlign='center';ctx.fillText('BALL KNOWER',0,4);
  ctx.fillStyle='#93b9cf';ctx.font='700 12px system-ui';ctx.fillText('OWN THE FIELD',0,29);ctx.restore();
  for(let line=y+8;line<y+252;line+=4){ctx.fillStyle='#ffffff08';ctx.fillRect(0,line,256,1);}
 }
 renderer.texture('bowl-ribbon',c);
 for(const side of [-1,1]){
  // New tier rises above the old press canopy instead of a flat wall horizon.
  for(let row=0;row<7;row++){
   const x=side*(48.4+row*.94),y=18.6+row*.77;
   box(x,y-.3,60,1.2,.6,132,row%2?'#354652':'#2c3b47');
   for(let seat=0;seat<106;seat++){
    if(seat%22<2)continue;
    fans.push([x,y-.12,-2+seat*1.23,1.02+random()*.12,1.42+random()*.14,Math.floor(random()*16),.72+random()*.18]);
   }
  }
  box(side*48.0,17.6,60,.40,.3,135,'#b1b6b2');
  const m=mul(translate(side*47.8,18.2,60),mul(rz(side*Math.PI/2),scale(.9,1,132)));
  add('plane',m,[1,1,1,1],'bowl-ribbon',true);
  // Repeating structural bays, glazed concourse and roof trusses.
  box(side*55.4,25.0,60,1.2,1.1,140,'#50606a');
  box(side*54.6,24.44,60,.15,.08,137,'#cad3ce',true);
  for(let z=-4;z<128;z+=11){
   beam([side*55.7,24.5,z],[side*44.7,27.1,z],.095,'#82939d');
   beam([side*44.7,27.1,z],[side*55.7,27.7,z],.075,'#71858e');
   beam([side*55.7,27.7,z],[side*55.7,24.5,z],.085,'#71858e');
  }
  // Bright narrow roof, with steel members visible against the sky.
  box(side*52.6,27.6,60,15,.22,144,'#52616c');
  box(side*45.2,27.2,60,.15,.13,143,'#dbe1dc',true);
  // Dedicated bench lanes, utility carts, coaching tablets and chain equipment.
  for(const z of [34,54,74,94]){
   box(side*29.0,.88,z,.9,.09,4.8,'#c0c6c5');
   for(const offset of [-1.8,1.8]){
    box(side*29.0,.46,z+offset,.14,.84,.16,'#536773');
    box(side*29.32,1.18,z+offset,.10,.35,.54,'#283b47');
   }
  }
  for(const z of [39,85]){
   box(side*29.6,.62,z,1.1,.70,1.75,'#193545');
   box(side*29.6,1.08,z,1.2,.16,1.85,'#c8ccc7');
   for(const offset of [-.59,.59])add('sphere',pose(side*29.6,.26,z+offset,.24,.24,.12),hex('#101a21'));
  }
  for(const z of [46,66]){
   beam([side*27.7,0,z],[side*27.7,2.4,z],.035,'#f29a43');
   box(side*27.7,2.5,z,.23,.33,.05,'#f08c34');
  }
 }
 // Architectural portals set back behind both end zones.
 for(const z of [-20,140]){
  box(0,22.4,z,76,1.4,1.2,'#354c5c');
  box(0,21.6,z,75,.12,.2,'#c2b185',true);
  for(let x=-35;x<=35;x+=7){
   box(x,19.6,z,5.8,2.9,.3,'#193543');
   box(x,18.3,z-.2,5.5,.12,.06,'#b4bbae',true);
   beam([x-3,18,z],[x-3,22,z],.06,'#85949b');
  }
 }
}
