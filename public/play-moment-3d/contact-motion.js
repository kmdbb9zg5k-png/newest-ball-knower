const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};

const CONTACT_FALL_TIMING={wrap:[.34,.46,.94],'drag-down':[.42,.58,.98],'low-wrap':[.20,.43,.94],'shoulder-hit':[.26,.36,.92],gang:[.34,.48,.96],dive:[.12,.30,.92],'big-hit':[.22,.30,.92]};

// Reach and establish contact before taking either athlete off his feet.
export function contactFallProgress(p){
 if(p.action==='get-up')return 1-smooth(p.actionT||0);
 if(!p.fallen)return 0;
 if(!/tackle|hit|gang|wrap|slide|dive|pancake/.test(p.action||''))return 1;
 // The defender establishes a low wrap before the runner loses his base.
 // Separate timing keeps contact from reading as two identical forward falls.
 const variant=p.contactVariant||p.action,tackler=p.contactRole==='tackler';
 const schedule=CONTACT_FALL_TIMING[variant]||CONTACT_FALL_TIMING.wrap,start=schedule[tackler?0:1];
 return smooth(((p.actionT||0)-start)/(schedule[2]-start));
}
export function contactBodyPose(p){
 if(!p.fallen)return{pitch:0,roll:0,kneel:0};
 const fall=contactFallProgress(p),t=p.actionT||0,tackler=p.contactRole==='tackler';
 if(!p.contactRole)return{pitch:fall*(p.action==='slide'?-.95:p.action==='big-hit'?1.42:p.action==='dive'?1.46:1.32),roll:fall*.16*(p.actionSide||1),kneel:0};
 const side=p.actionSide||1,brace=smooth(t/.20)*(1-smooth((t-.48)/.52));
 return tackler
  ?{pitch:.24*brace+.98*fall,roll:-side*.42*fall,kneel:.20*brace}
  :{pitch:.10*brace+1.20*fall,roll:side*.46*fall,kneel:.055*brace};
}

// Distinct skeletal finishes. Values are pelvis rotations, not whole-model tips.
export function contactFinishPose(p){
 const tackler=p.contactRole==='tackler',variant=p.contactVariant||p.action,side=p.actionSide||1;
 const profiles={
  wrap:[1.25,1.10,.65,1.18,.57,.72],
  'drag-down':[1.10,.92,.75,1.38,.59,.73],
  'low-wrap':[1.40,1.25,.30,.80,.58,.66],
  'shoulder-hit':[1.24,.75,.50,1.40,.52,.66],
  'big-hit':[1.24,.75,.50,1.40,.52,.66],
  gang:[1.24,1.10,.55,1.10,.54,.66],
  dive:[1.42,1.50,.30,.70,.58,.74]
 };
 const v=profiles[variant]||profiles.wrap;
 return {pitch:v[tackler?0:1],roll:side*v[tackler?2:3]*(tackler?-1:1),drop:v[tackler?4:5],load:tackler?(variant==='low-wrap'?.34:.20):.09,footBack:tackler?.62:variant==='drag-down'?.68:.48};
}
export function contactFacing(p){
 if(p.contactRole==='tackler'&&p.contactTarget&&p.fallen){
  const target=p.contactHands?p.contactHands[0].map((v,i)=>(v+p.contactHands[1][i])*.5):p.contactTarget;
  // Face the runner while establishing the wrap, then align with the impact.
  // Chasing a moving hand target after landing made the grounded body rotate.
  const facing=Math.atan2(target[0]-p.x,target[2]-p.z),start=p.contactStartHeading??p.heading??facing;
  const wrap=start+Math.atan2(Math.sin(facing-start),Math.cos(facing-start))*smooth((p.actionT||0)/.18),finish=Number.isFinite(p.fallHeading)?p.fallHeading:wrap;
  return wrap+Math.atan2(Math.sin(finish-wrap),Math.cos(finish-wrap))*smooth(((p.actionT||0)-.42)/.40);
 }
 const end=Number.isFinite(p.fallHeading)?p.fallHeading:p.heading||0;
 if(!p.fallen||!Number.isFinite(p.contactStartHeading))return p.fallen?end:p.heading||0;
 const t=smooth(((p.actionT||0)-.18)/.52),start=p.contactStartHeading;
 return start+Math.atan2(Math.sin(end-start),Math.cos(end-start))*t;
}
export function updateContactTarget(tackler,runner){
 const fall=contactFallProgress(runner),heading=runner.fallHeading??runner.heading??0;
 tackler.contactTarget=[runner.x+Math.sin(heading)*fall*.8,1.12-fall*.76,runner.z+Math.cos(heading)*fall*.8];
}

// A moving exchange: meet the quarterback with a nonzero outgoing tangent,
// then carry that velocity through possession instead of parking at the mesh.
export function handoffRunnerPoint(start,mesh,progress,duration,direction,speed=4.6){
 const pickup=.88,t=clamp(progress,0,1),seconds=Math.max(.1,duration),length=Math.hypot(...direction)||1,v=direction.map(n=>n/length*speed);
 if(t>=pickup)return mesh.map((n,i)=>n+v[i]*(t-pickup)*seconds);
 const u=t/pickup,h=3*u*u-2*u*u*u,tangent=u*u*u-u*u,entry=u*u*u-2*u*u+u;
 const gap=Math.hypot(...mesh.map((n,i)=>n-start[i]))||1;
 // Start with a short first step instead of stopping completely at the snap.
 const entrySpeed=Math.min(2.2,gap/(seconds*pickup));
 return start.map((n,i)=>n+(mesh[i]-n)*h+seconds*pickup*(v[i]*tangent+(mesh[i]-n)/gap*entrySpeed*entry));
}

export function handoffDuration(concept){return concept.handoff+(concept.option?.30:.38)}

// Open the QB's hips and keep a pocket for the ball on the near side of the RB.
// World-space hand targets stay within the two athletes' shared reach.
export function handoffBall(qb,rb,t,keep=false){
 const dx=rb.x-qb.x,dz=rb.z-qb.z,gap=Math.hypot(dx,dz)||1,nx=dx/gap,nz=dz/gap;
 const grip=[qb.x+nx*.34,1.30,qb.z+nz*.34];
 const pocket=[rb.x-nx*.22,1.25,rb.z-nz*.22];
 const reach=smooth((t-.38)/.42),withdraw=keep?smooth((t-.70)/.18):0;
 const ball=grip.map((v,i)=>v+(pocket[i]-v)*reach*(1-withdraw));
 return{ball,qbTarget:t<.88?ball:grip,rbTarget:t>.38&&!keep?ball:null};
}

// One planted push and recovery step while the wrap loads. The carrier's
// staggered recovery is later than the tackler's drive; both settle at landing.
export function contactFootTarget(p,sign){
 const t=clamp(p.actionT||0,0,1),fall=contactFallProgress(p),finish=contactFinishPose(p),tackler=p.contactRole==='tackler',side=p.actionSide||1,variant=p.contactVariant||p.action;
 const lead=sign===side,start=tackler?(lead?.08:.28):(lead?.22:.40),end=start+.30;
 const step=smooth((t-start)/(end-start)),lift=Math.sin(Math.PI*clamp((t-start)/(end-start),0,1)),drive=(1-fall)*(variant==='dive'?.25:1);
 const travel=(tackler?.24:.18)*drive,stagger=lead?.16:-.16;
 return [sign*(.19+.08*fall),.075+(lead?.04*fall:0)+lift*(tackler?.07:.10)*drive,stagger*(1-fall)+travel*(2*step-1)-(finish.footBack+.35)*fall];
}
