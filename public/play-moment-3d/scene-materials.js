/** Optional, original scene art. Gameplay starts immediately with the existing fallback. */
export function installSceneMaterials(renderer){
 const state={turf:false,crowd:false,sideline:false,failed:[]};
 const load=(name,url,repeat=false)=>new Promise(resolve=>{
  const image=new Image();image.decoding='async';
  image.onload=()=>{
   if(renderer.lost){resolve(false);return;}
   try{renderer.texture(name,image,repeat);state[name==='turf-detail'?'turf':name==='crowd-atlas'?'crowd':'sideline']=true;resolve(true)}catch{state.failed.push(name);resolve(false)}
  };
  image.onerror=()=>{state.failed.push(name);resolve(false)};image.src=url;
 });
 state.ready=Promise.all([
  load('turf-detail','/play-moment-3d/assets/stadium-turf-v1.webp',true),
  load('crowd-atlas','/play-moment-3d/assets/stadium-fans-v1.webp'),
  load('sideline-atlas','/play-moment-3d/assets/stadium-sideline-v1.webp'),
 ]);
 if(new URLSearchParams(location.search).has('qa'))window.bkSceneArtDiagnostics=()=>({turf:state.turf,crowd:state.crowd,sideline:state.sideline,failed:[...state.failed]});
 return state;
}
