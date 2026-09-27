// Formation coordinates are shared by the menu diagrams and live lineups.
// Offensive actor order: five OL, QB, HB, X, slot/FB, Z, TE.
export const FORMATIONS = Object.freeze([
 {id:'shotgun',name:'SHOTGUN',personnel:'11 PERSONNEL',positions:[[0,-5],[-2,-7],[-21,0],[-12,-.6],[21,0],[6.5,-.4]]},
 {id:'pistol',name:'PISTOL',personnel:'11 PERSONNEL',positions:[[0,-3.6],[0,-7.5],[-21,0],[-11,-.8],[21,0],[6.5,-.4]]},
 {id:'singleback',name:'SINGLEBACK',personnel:'11 PERSONNEL',positions:[[0,-1.6],[0,-6.8],[-21,0],[-10,-.8],[21,0],[6.5,-.4]]},
 {id:'iform',name:'I-FORMATION',personnel:'21 PERSONNEL',positions:[[0,-1.6],[0,-7.5],[-21,0],[0,-4.4],[21,0],[6.5,-.4]],fullback:true},
 {id:'wildcat',name:'WILDCAT',personnel:'DIRECT SNAP',positions:[[20,-1],[0,-5.5],[-21,0],[-9,-1],[21,0],[6.5,-.4]],snapReceiver:6},
].map(f=>Object.freeze({...f,positions:Object.freeze(f.positions.map(Object.freeze))})));
export function formationForPlay(play){return FORMATIONS.find(f=>f.id===play.formation)||FORMATIONS[0]}
const BASE_RUNS=Object.freeze([
 Object.freeze({id:'zone',name:'INSIDE ZONE',path:Object.freeze([[0,0],[-1.2,3],[-3.2,8],[0,17],[2,28]]),handoff:.58,mesh:Object.freeze([-.5,-3.1]),pathSpeed:7,pathLead:3.6,guideSeconds:1.55,steering:.7,speed:.98,acceleration:1.02,blockLeverage:.18,icon:'M24 23L24 13L17 5M17 5L17 11M17 5L23 5'}),
 Object.freeze({id:'stretch',name:'HB STRETCH',path:Object.freeze([[0,0],[5.5,1],[11.5,4],[16,10],[18,25]]),handoff:.5,mesh:Object.freeze([2.8,-3.8]),pathSpeed:7.7,pathLead:4.4,guideSeconds:1.8,steering:.78,speed:1.03,acceleration:1.06,blockLeverage:.34,icon:'M12 23L18 14L36 6M36 6L29 6M36 6L34 13'}),
 Object.freeze({id:'counter',name:'COUNTER',path:Object.freeze([[0,0],[-4.8,-.5],[-6,2],[1.5,8],[8.5,17],[10,28]]),handoff:.68,mesh:Object.freeze([-4.2,-3.7]),pathSpeed:6.6,pathLead:3,guideSeconds:2.05,steering:.82,speed:1.01,acceleration:.93,blockLeverage:.42,icon:'M26 23L15 19L15 13L31 5M31 5L24 5M31 5L29 11'}),
 Object.freeze({id:'toss',name:'HB TOSS',path:Object.freeze([[0,0],[7,-1],[13,1],[19,7],[21,24]]),handoff:.38,mesh:Object.freeze([5.4,-4.7]),pathSpeed:8.25,pathLead:5.2,guideSeconds:1.9,steering:.86,speed:1.07,acceleration:1.11,blockLeverage:.5,icon:'M10 23L34 18L36 5M36 5L30 10M36 5L41 11'}),
]);
const BASE_PASSES=[
 {id:'mesh',name:'MESH',routes:[[[0,0],[0,5],[17,9],[28,9]],[[0,0],[0,6],[-5,10],[-14,10]],[[0,0],[0,8],[-3,18],[-3,32]],[[0,0],[0,7],[-7,12],[-13,16]],[[0,0],[4,2],[8,7],[12,10]]],icon:'M5 23L5 14L35 6M42 23L42 14L12 6'},
 {id:'verts',name:'VERTICALS',routes:[[[0,0],[0,35]],[[0,0],[2,35]],[[0,0],[0,35]],[[0,0],[-2,28]],[[0,0],[-4,3],[-5,10],[0,15]]],icon:'M8 23L8 4M24 23L24 4M40 23L40 4M4 9L8 4L12 9M20 9L24 4L28 9M36 9L40 4L44 9'},
 {id:'flood',name:'FLOOD',routes:[[[0,0],[0,8],[17,14],[24,18]],[[0,0],[0,5],[20,9]],[[0,0],[0,12],[-4,29]],[[0,0],[4,5],[14,13]],[[0,0],[-5,1],[-10,5],[-13,8]]],icon:'M6 23L6 14L24 8M22 23L22 16L42 16M39 23L39 4'},
 {id:'dagger',name:'DAGGER',routes:[[[0,0],[0,16],[19,16]],[[0,0],[1,24],[5,32]],[[0,0],[0,20],[-17,20]],[[0,0],[0,8],[-8,13],[-15,13]],[[0,0],[4,2],[8,7],[10,12]]],icon:'M8 23L8 9L22 9M26 23L26 3M40 23L40 14L29 14'},
];

const run=(id,name,formation,scheme,options={})=>Object.freeze({...BASE_RUNS[scheme],id,name,formation,scheme,...options});
const pass=(id,name,formation,routes)=>Object.freeze({id,name,formation,routes});
const slants=[[[0,0],[0,3],[13,13]],[[0,0],[0,3],[10,11]],[[0,0],[0,3],[-13,13]],[[0,0],[4,1],[10,2]],[[0,0],[-5,1],[-11,3]]];
const curls=[[[0,0],[0,12],[2,10]],[[0,0],[0,10],[3,8]],[[0,0],[0,12],[-2,10]],[[0,0],[4,2],[12,3]],[[0,0],[-5,2],[-12,3]]];
const stick=[[[0,0],[0,30]],[[0,0],[0,6],[3,5]],[[0,0],[0,28]],[[0,0],[0,6],[4,6]],[[0,0],[5,1],[13,2]]];
const levels=[[[0,0],[0,12],[23,12]],[[0,0],[0,5],[20,5]],[[0,0],[0,30]],[[0,0],[0,8],[-16,8]],[[0,0],[-4,2],[-10,3]]];
const smash=[[[0,0],[0,6],[1,5]],[[0,0],[0,11],[-9,23]],[[0,0],[0,6],[-1,5]],[[0,0],[0,12],[12,24]],[[0,0],[-5,1],[-10,4]]];
const boot=[[[0,0],[0,17],[18,23]],[[0,0],[5,1],[12,3]],[[0,0],[0,30]],[[0,0],[0,9],[14,11]],[[0,0],[-5,0],[-10,4]]];
const cross=[[[0,0],[0,15],[22,18]],[[0,0],[-6,2],[-12,4]],[[0,0],[0,27],[-8,35]],[[0,0],[0,10],[-19,13]],[[0,0],[5,2],[11,5]]];
const dive=[[0,-3],[0,0],[.6,4],[.6,15],[2,28]];
const power=[[0,-3],[2,0],[3.5,5],[6,14],[7,28]];
export const RUNS=Object.freeze([
 ...BASE_RUNS.map((p,scheme)=>Object.freeze({...p,formation:'shotgun',scheme,pitch:scheme===3})),
 run('gun-read','ZONE READ','shotgun',0,{option:true,mesh:[-1.7,-4.7],path:[[0,-3],[-3,0],[-3,5],[-4,18]],keepPath:[[0,-4],[5,-2],[8,4],[10,22]]}),
 run('gun-draw','HB DRAW','shotgun',0,{handoff:.9,mesh:[0,-3.5],path:[[0,-3],[0,1],[1.8,7],[1.8,22]]}),
 run('pistol-read','PISTOL READ','pistol',0,{option:true,mesh:[-.8,-4.6],path:dive,keepPath:[[0,-4],[6,-2],[10,4],[14,22]]}),
 run('pistol-power','POWER','pistol',2,{mesh:[.8,-4.5],path:power}),
 run('single-zone','HB ZONE','singleback',0,{mesh:[-.5,-3],path:dive}),
 run('single-stretch','OUTSIDE ZONE','singleback',1,{mesh:[2.3,-3.8]}),
 run('i-dive','HB DIVE','iform',0,{mesh:[0,-3.1],path:dive}),
 run('i-power','POWER O','iform',2,{mesh:[.8,-3.8],path:power}),
 run('i-toss','TOSS CRACK','iform',3,{pitch:true,mesh:[5.4,-4.7]}),
 run('i-counter','COUNTER LEAD','iform',2,{mesh:[-2.8,-3.8]}),
 run('wild-power','WILDCAT POWER','wildcat',2,{direct:true,path:power}),
 run('wild-sweep','WILDCAT SWEEP','wildcat',1,{direct:true,path:[[0,-5.5],[6,-3],[12,1],[17,10],[18,25]]}),
 run('wild-counter','WILDCAT COUNTER','wildcat',2,{direct:true}),
 run('wild-dive','WILDCAT DIVE','wildcat',0,{direct:true,path:dive}),
]);
export const PASSES=Object.freeze([
 ...BASE_PASSES.map(p=>Object.freeze({...p,formation:'shotgun'})),
 pass('gun-slants','QUICK SLANTS','shotgun',slants),
 pass('gun-curls','CURL FLAT','shotgun',curls),
 pass('gun-stick','STICK','shotgun',stick),
 pass('gun-levels','LEVELS','shotgun',levels),
 pass('pistol-smash','SMASH','pistol',smash),
 pass('pistol-flood','FLOOD RIGHT','pistol',BASE_PASSES[2].routes),
 pass('single-curls','CURLS','singleback',curls),
 pass('single-levels','DRIVE','singleback',levels),
 pass('i-cross','DEEP CROSS','iform',cross),
 pass('i-out','TE OUT','iform',boot),
]);
export function matchingPlays(formation='all',filter='all'){
 return [['run',RUNS],['pass',PASSES]].flatMap(([mode,plays])=>plays.map((play,index)=>({mode,index,play}))).filter(({mode,play})=>(formation==='all'||play.formation===formation)&&(filter==='all'||filter===mode||(filter==='read'&&play.option)));
}
export function blockingScheme(index){return RUNS[index]?.scheme??0}
