const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);

// A short center release, a fast flight, then a two-handed gather. The QB
// presents his hands at the catch point; he does not reach toward the center.
export function snapExchange(center,receiver,elapsed){
 const short=Math.hypot(center.x-receiver.x,center.z-receiver.z)<2.5;
 const release=.055,arrival=short?.19:.27,duration=arrival+.10;
 const from=[center.x,.42,center.z-.20],catchPoint=[receiver.x,1.32,receiver.z+.42],grip=[receiver.x,1.38,receiver.z+.30];
 const flight=clamp((elapsed-release)/(arrival-release)),gather=smooth((elapsed-arrival)/.10);
 const ball=elapsed<arrival?mix(from,catchPoint,flight):mix(catchPoint,grip,gather);
 ball[1]+=Math.sin(flight*Math.PI)*(short?.035:.065)*(1-gather);
 return{ball,target:mix(catchPoint,grip,gather),centerTarget:mix(from,[center.x,.63,center.z-.52],smooth(elapsed/.12)),progress:clamp(elapsed/duration),duration};
}
