/** Rounded bowl geometry. All decoration stays outside the playing surface. */
import {pose,mul,ry,translate,scale,segment,hex} from './renderer.js?v=stadium-finish-36';
export function stadiumCorners(add,fan){
 for(const sx of[-1,1])for(const sz of[-1,1]){
  const z0=sz<0?0:120;
  for(let row=0;row<14;row++){
   const radius=6+row*.95,y=1.5+row*.74,segments=18;
   for(let k=0;k<segments;k++){
    const a=(k+.5)/segments*Math.PI/2,x=sx*(27+radius*Math.cos(a)),z=z0+sz*radius*Math.sin(a);
    const angle=Math.atan2(-sz*Math.cos(a),-sx*Math.sin(a));
    add('cube',mul(translate(x,y-.27,z),mul(ry(angle),scale(radius*Math.PI/2/segments+.08,.58,1.15))),hex(row%3?'#1b2933':'#2b3942'));
    if(k!==8&&k!==9)fan(x,y-.12,z,row,k);
   }
  }
  // Continuous front rail and panel wall around the curved corner.
  for(let k=0;k<16;k++){
   const a=k/16*Math.PI/2,b=(k+1)/16*Math.PI/2;
   const p=t=>[sx*(27+4.6*Math.cos(t)),1.9,z0+sz*4.6*Math.sin(t)];
   add('cylinder',segment(p(a),p(b),.045),hex('#9da4a5'));
   const middle=(a+b)/2,x=sx*(27+4.6*Math.cos(middle)),z=z0+sz*4.6*Math.sin(middle),angle=Math.atan2(-sz*Math.cos(middle),-sx*Math.sin(middle));
   add('cube',mul(translate(x,.82,z),mul(ry(angle),scale(.53,1.55,.30))),hex('#132431'));
   if(k%3===0)add('cylinder',segment([p(a)[0],.75,p(a)[2]],p(a),.035),hex('#687e89'));
  }
 }
}
export function stadiumDetails(add){
 const box=(x,y,z,w,h,d,c,unlit=false)=>add('cube',pose(x,y,z,w,h,d),hex(c),'',unlit);
 for(const end of[-6,126]){
  const sign=end<0?-1:1;
  // Section aisles, handrails, front barrier and directional stadium signage.
  box(0,.9,end-sign*1.5,55,1.8,.4,'#152733');
  for(const x of[-18.4,0,18.4]){
   for(let row=0;row<14;row++){
    if(x===0&&row<4)continue;
    box(x,1.23+row*.74,end+sign*row*.95,1.08,.14,.9,'#516068');
    if(row%3===0)box(x,1.32+row*.74,end+sign*(row*.95-.35),.48,.018,.05,'#c8bd91',true);
   }
   for(const dx of[-.55,.55])add('cylinder',segment([x+dx,2.4,end],[x+dx,12.0,end+sign*12.35],.028),hex('#9aa4a4'));
  }
  // Framed suite glazing: narrow mullions and uneven warm interior lighting.
  const rear=end+sign*15.4;
  for(let x=-38,bay=0;x<=38;x+=4,bay++){
   box(x,13.5,rear-sign*1.075,2.8,1.5,.035,bay%4===1?'#23323a':bay%3===0?'#514c3d':'#746a50',true);
   for(const dx of[-.9,0,.9])box(x+dx,13.5,rear-sign*1.14,.055,1.7,.07,'#15232c');
   box(x,13.3,rear-sign*1.15,2.9,.055,.08,'#182832');
  }
 }
 // Wheelable equipment, bench cushions and drink stations beyond the boundary.
 for(const side of[-1,1])for(const z of[32,52,72,92]){
  box(side*29.35,.38,z,1.1,.65,1.4,'#172c3c');box(side*29.35,.74,z,1.18,.1,1.48,'#728087');
  for(const dz of[-.48,.48])box(side*29.35,.09,z+dz,1.2,.18,.16,'#080e14');
  box(side*29.35,1.02,z,.55,.50,.55,'#c0793c');box(side*29.35,1.3,z,.60,.08,.60,'#d9d9c8');
 }
}
