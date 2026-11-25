/** Lightweight HUD canvas; no extra WebGL draws or pointer/touch interception. */
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function nearFootballHotZones(position){
 if(!position)return [];
 const [x,,z]=position,zones=[];
 if(z>=84&&z<=113){
  zones.push({x:0,z:92,radius:5,type:'red-zone'});
  if(Math.abs(x)>17&&z>=95)zones.push({x:Math.sign(x)*24,z:108,radius:3.6,type:'corner'});
 }
 if(Math.abs(x)>21.5&&z>=10&&z<=110)zones.push({x:Math.sign(x)*25,z:clamp(z,10,110),radius:2.1,type:'sideline'});
 return zones;
}

export function createBallTrackingHud(host){
 const canvas=document.createElement('canvas');
 canvas.setAttribute('aria-hidden','true');
 Object.assign(canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',zIndex:'1'});
 host.append(canvas);
 const ctx=canvas.getContext('2d');
 return {draw({telemetry,project,width,height,fade=0}){
  if(!ctx)return;
  const w=Math.max(1,Math.round(width)),h=Math.max(1,Math.round(height));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  ctx.clearRect(0,0,w,h);
  if(!telemetry||!Number.isFinite(telemetry.groundSpeed))return;
  for(const zone of nearFootballHotZones(telemetry.position)){
   const p=project([zone.x,.08,zone.z]);
   const edge=project([zone.x+zone.radius,.08,zone.z]);
   if(!p.visible||!edge.visible||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
   const radius=clamp(Math.abs(edge.x-p.x),8,55);
   ctx.beginPath();ctx.arc(p.x,p.y,radius,0,2*Math.PI);
   ctx.fillStyle='rgba(247,197,91,.08)';ctx.strokeStyle='rgba(247,197,91,.36)';ctx.lineWidth=1.5;
   ctx.fill();ctx.stroke();
  }
  const p=project(telemetry.position),q=project(telemetry.predicted);
  if(p.visible&&q.visible&&[p.x,p.y,q.x,q.y].every(Number.isFinite)){
   const dx=q.x-p.x,dy=q.y-p.y,length=Math.hypot(dx,dy);
   if(length>2){
    const size=clamp(length,12,34),ux=dx/length,uy=dy/length;
    const ax=p.x+ux*size,ay=p.y+uy*size;
    ctx.strokeStyle='rgba(126,230,236,.93)';ctx.lineWidth=2;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(ax,ay);ctx.stroke();
    ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(ax-ux*8-uy*4,ay-uy*8+ux*4);
    ctx.moveTo(ax,ay);ctx.lineTo(ax-ux*8+uy*4,ay-uy*8-ux*4);ctx.stroke();
    ctx.font='600 10px system-ui';ctx.fillStyle='rgba(222,247,248,.9)';
    ctx.fillText(Math.round(telemetry.groundSpeed)+' yd/s',clamp(ax+8,8,w-55),clamp(ay-7,78,h-12));
   }
  }
  if(fade>0){ctx.fillStyle=`rgba(6,13,21,${clamp(fade,0,.18)})`;ctx.fillRect(0,0,w,h);}
 }};
}
