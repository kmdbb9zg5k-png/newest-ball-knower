/** Presentation-only look-ahead. This does not change passes or catch outcomes. */
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=v=>typeof v==='number'&&Number.isFinite(v);

/** Match the current pass animation while deriving a velocity vector from it. */
export function flightTelemetry(flight,lookAhead=.12){
 if(!flight||!Array.isArray(flight.from)||!Array.isArray(flight.to)||
    flight.from.length!==3||flight.to.length!==3||
    ![...flight.from,...flight.to,flight.duration,flight.t,flight.arc].every(finite)||flight.duration<=0)return null;
 const t=clamp(flight.t,0,1),duration=flight.duration,arc=Math.max(0,flight.arc);
 const delta=flight.to.map((v,i)=>v-flight.from[i]);
 const position=flight.from.map((v,i)=>v+delta[i]*t);
 position[1]+=arc*Math.sin(Math.PI*t);
 const velocity=[delta[0]/duration,(delta[1]+arc*Math.PI*Math.cos(Math.PI*t))/duration,delta[2]/duration];
 // A constant-gravity approximation to the existing sinusoidal pass arc.
 const gravity=8*arc/(duration*duration);
 const seconds=clamp(Number.isFinite(lookAhead)?lookAhead:0,0,Math.min(.20,(1-t)*duration));
 const predicted=[position[0]+velocity[0]*seconds,
  Math.max(.1,position[1]+velocity[1]*seconds-.5*gravity*seconds*seconds),
  position[2]+velocity[2]*seconds];
 return {position,predicted,velocity,gravity,seconds,
  groundSpeed:Math.hypot(velocity[0],velocity[2]),
  heading:Math.atan2(velocity[0],velocity[2])};
}

/** The runner's arrow uses real ground velocity, not a simulated throw. */
export function runnerTelemetry(runner){
 if(!runner||![runner.x,runner.z,runner.vx,runner.vz].every(finite))return null;
 const speed=Math.hypot(runner.vx,runner.vz);if(speed<.7)return null;
 return {position:[runner.x,1.6,runner.z],predicted:[runner.x+runner.vx*.25,1.6,runner.z+runner.vz*.25],
  groundSpeed:speed,heading:Math.atan2(runner.vx,runner.vz)};
}
