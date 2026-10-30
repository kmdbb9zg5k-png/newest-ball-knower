import * as T from 'three';

// Garments reuse the athlete's bind-space skin weights so sleeves and trouser
// legs bend with the existing animation rig, including customized body builds.
export function createAthleteGarments(body) {
  const sources=[];
  body.traverse(mesh=>{if(mesh.isSkinnedMesh)sources.push(mesh);});
  let key='',parts=[];
  function clear(){for(const mesh of parts){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.userData.jerseyTexture?.dispose();mesh.material.dispose();}parts=[];}
  function garment(source,item){
    const style=item.style;if(!style)return;
    const top=item.slot==='top',hood=style==='hoodie',short=style==='tee'||style==='jersey',denim=style==='jeans';
    const g=source.geometry.clone(),p=g.attributes.position,n=g.attributes.normal,indices=[];
    const length=short?21:34;
    const inside=(i)=>{const x=Math.abs(p.getX(i)),y=p.getY(i);return top?y>=54&&y<=83&&x<length:y>=9&&y<=55&&x<15;};
    const original=g.index;
    for(let i=0;i<(original?.count||p.count);i+=3){const ids=[0,1,2].map(k=>original?original.getX(i+k):i+k);if(ids.every(inside))indices.push(...ids);}
    g.setIndex(indices);
    const averaged=new Map();
    const vertexKey=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(3)).join(',');
    for(let i=0;i<p.count;i++){const k=vertexKey(i);if(!averaged.has(k))averaged.set(k,new T.Vector3());averaged.get(k).add(new T.Vector3().fromBufferAttribute(n,i));}
    for(const normal of averaged.values())normal.normalize();
    const offsets=Array.from({length:p.count},(_,i)=>averaged.get(vertexKey(i)));
    for(let i=0;i<p.count;i++){
      const x=Math.abs(p.getX(i)),y=p.getY(i);
      let ease=top?(hood?1.15:.65):(denim?.6:1.05);
      // Sleeves and joggers taper into their cuffs, with room through the body.
      if(top&&x>length-2||!top&&y<13)ease=.35;
      p.setXYZ(i,p.getX(i)+offsets[i].x*ease,p.getY(i)+offsets[i].y*ease,p.getZ(i)+offsets[i].z*ease);
      // Smooth the silhouette into fabric while retaining the exact source
      // skin weights and seams; fabric no longer follows individual muscles.
      if(top&&x>11&&x<length&&y>65){
        const t=T.MathUtils.clamp((x-11)/23,0,1),cy=74.9,cz=T.MathUtils.lerp(-3.5,-1.5,t),dy=p.getY(i)-cy,dz=p.getZ(i)-cz;
        const radius=Math.max(Math.hypot(dy,dz),T.MathUtils.lerp(5.5,3.1,t));const angle=Math.atan2(dz,dy);p.setY(i,cy+Math.cos(angle)*radius);p.setZ(i,cz+Math.sin(angle)*radius);
      }
      if(!top&&y<36){const t=T.MathUtils.clamp((36-y)/26,0,1),cx=Math.sign(p.getX(i))*T.MathUtils.lerp(6.7,8.6,t),cz=T.MathUtils.lerp(0,-2.3,t),dx=p.getX(i)-cx,dz=p.getZ(i)-cz;const radius=Math.max(Math.hypot(dx,dz),T.MathUtils.lerp(5.8,3.1,t));const angle=Math.atan2(dz,dx);p.setX(i,cx+Math.cos(angle)*radius);p.setZ(i,cz+Math.sin(angle)*radius);}

    }
    g.computeVertexNormals();
    const smoothNormals=new Map(),gn=g.attributes.normal;
    for(let i=0;i<p.count;i++){const k=vertexKey(i);if(!smoothNormals.has(k))smoothNormals.set(k,new T.Vector3());smoothNormals.get(k).add(new T.Vector3().fromBufferAttribute(gn,i));}
    for(const normal of smoothNormals.values())normal.normalize();
    for(let i=0;i<p.count;i++){const normal=smoothNormals.get(vertexKey(i));gn.setXYZ(i,normal.x,normal.y,normal.z);}
    const material=new T.MeshStandardMaterial({color:item.color,roughness:denim?.93:.88,side:T.DoubleSide});
    let jerseyTexture=null;
    if(item.jersey){
      const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
      const ctx=canvas.getContext('2d');ctx.textAlign='center';ctx.fillStyle='#ffffff';ctx.strokeStyle='#101820';ctx.lineJoin='round';
      for(const [center,label] of [[256,item.jersey.team],[768,item.jersey.playerName]]){
        ctx.font='bold 42px sans-serif';ctx.lineWidth=4;ctx.strokeText(label,center,95,440);ctx.fillText(label,center,95,440);
        ctx.font='900 270px sans-serif';ctx.lineWidth=9;ctx.strokeText(String(item.jersey.number),center,390,420);ctx.fillText(String(item.jersey.number),center,390,420);
      }
      jerseyTexture=new T.CanvasTexture(canvas);material.userData.jerseyTexture=jerseyTexture;
    }
    material.onBeforeCompile=shader=>{
      if(jerseyTexture){shader.uniforms.jerseyPrint={value:jerseyTexture};shader.uniforms.jerseyAccent={value:new T.Color(item.accent)};}

      shader.vertexShader='varying vec3 garmentPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngarmentPosition=position;');
      shader.fragmentShader=(jerseyTexture?'uniform sampler2D jerseyPrint; uniform vec3 jerseyAccent;\n':'')+'varying vec3 garmentPosition;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        ${jerseyTexture?`float back=step(garmentPosition.z,-2.0);
        vec2 printUV=vec2((mix(garmentPosition.x,-garmentPosition.x,back)+9.)/18.,(garmentPosition.y-58.)/21.);
        if(printUV.x>=0.&&printUV.x<=1.&&printUV.y>=0.&&printUV.y<=1.){vec4 ink=texture2D(jerseyPrint,vec2(printUV.x*.5+back*.5,printUV.y));diffuseColor.rgb=mix(diffuseColor.rgb,ink.rgb,ink.a);}
        float stripe=step(18.,abs(garmentPosition.x))*(1.-step(20.,abs(garmentPosition.x)));diffuseColor.rgb=mix(diffuseColor.rgb,jerseyAccent,stripe);`:''}
        float fabricAA=1.-smoothstep(.3,1.,fwidth(garmentPosition.x*9.));
        float weave=sin((garmentPosition.x+garmentPosition.y)*55.)*sin(garmentPosition.y*43.);
        diffuseColor.rgb*=1.+${denim?'.12':'.035'}*weave*fabricAA;
        ${!top?`float seam=1.-smoothstep(.10,.26,abs(abs(garmentPosition.x)-7.));
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*${denim?'1.6':'.7'},seam*.4);
        float cuff=1.-smoothstep(11.,12.,garmentPosition.y);diffuseColor.rgb*=1.-cuff*.18;`:''}
      `);
    };
    material.customProgramCacheKey=()=>`garment-${style}`;
    const mesh=new T.SkinnedMesh(g,material);mesh.name=`Wardrobe ${style}`;mesh.position.copy(source.position);mesh.quaternion.copy(source.quaternion);mesh.scale.copy(source.scale);mesh.bindMode=source.bindMode;mesh.bind(source.skeleton,source.bindMatrix);mesh.castShadow=true;mesh.frustumCulled=false;source.parent.add(mesh);parts.push(mesh);
    if(hood){
      // An open, folded hood behind the neck; a separate skinned piece gives
      // the hoodie an actual silhouette rather than a painted-on collar.
      const hoodGeometry=new T.SphereGeometry(1,24,16,0,Math.PI*2,Math.PI*.25,Math.PI*.65);
      hoodGeometry.scale(6.5,6,4.5);hoodGeometry.rotateX(-.8);hoodGeometry.translate(0,79,-5);
      const hp=hoodGeometry.attributes.position,skinIndex=[],skinWeight=[];
      for(let i=0;i<hp.count;i++){
        let best=0,distance=Infinity;
        for(let j=0;j<p.count;j+=24){const d=(p.getX(j)-hp.getX(i))**2+(p.getY(j)-76)**2+(p.getZ(j)+3)**2;if(d<distance){distance=d;best=j;}}
        for(let k=0;k<4;k++){skinIndex.push(g.attributes.skinIndex.getComponent(best,k));skinWeight.push(g.attributes.skinWeight.getComponent(best,k));}
      }
      hoodGeometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIndex,4));hoodGeometry.setAttribute('skinWeight',new T.Float32BufferAttribute(skinWeight,4));
      const hoodMesh=new T.SkinnedMesh(hoodGeometry,material.clone());hoodMesh.name='Wardrobe folded hood';hoodMesh.position.copy(source.position);hoodMesh.quaternion.copy(source.quaternion);hoodMesh.scale.copy(source.scale);hoodMesh.bindMode=source.bindMode;hoodMesh.bind(source.skeleton,source.bindMatrix);hoodMesh.castShadow=true;hoodMesh.frustumCulled=false;source.parent.add(hoodMesh);parts.push(hoodMesh);
    }
  }
  return {apply(outfit){const next=outfit?[outfit.top.id,outfit.shorts.id,JSON.stringify(outfit.top.jersey)].join('|'):'';if(next===key)return;key=next;clear();if(outfit)for(const source of sources)for(const item of [outfit.top,outfit.shorts])garment(source,item);},dispose:clear};
}
