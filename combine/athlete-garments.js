import * as T from 'three';
import {clipGarment,trouserGeometry,topGeometry} from './garment-geometry.js';
import {bodyMass,createBodyShape} from './body-shape.js';

// Garments reuse the athlete's bind-space skin weights so sleeves and trouser
// legs bend with the existing animation rig, including customized body builds.
export function createAthleteGarments(body) {
  const sources=[];
  body.traverse(mesh=>{if(mesh.isSkinnedMesh)sources.push(mesh);});
  let key='',parts=[];
  function clear(){for(const mesh of parts){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.userData.jerseyTexture?.dispose();mesh.material.dispose();}parts=[];}
  function garment(source,item,player){
    const style=item.style;if(!style)return;
    const top=item.slot==='top',hood=style==='hoodie',short=style==='tee'||style==='jersey',denim=style==='jeans';
    const length=short?21:34;
    const base=top?topGeometry():trouserGeometry();
    // Shape the fabric in bind space before clipping the hems, so the folds
    // follow the same skin weights as the surrounding cloth.
    if(hood||style==='sweats'){
      const {position,normal}=base.attributes;
      for(let i=0;i<position.count;i++){
        const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
        const along=hood&&Math.abs(x)>18?Math.abs(x):y;
        const gather=hood?Math.max(Math.exp(-((y-57)**2)/11),Math.exp(-((Math.abs(x)-29)**2)/14)):Math.max(Math.exp(-((y-14)**2)/18),Math.exp(-((y-29)**2)/32));
        const fold=.36*gather*(.5+.5*Math.sin(along*1.65+z*.36+x*.24));
        position.setXYZ(i,x+normal.getX(i)*fold,y+normal.getY(i)*fold,z+normal.getZ(i)*fold);
      }
      base.computeVertexNormals();
    }
    const g=top?clipGarment(base,[p=>length-p.x,p=>length+p.x]):base;
    if(top)base.dispose();
    const p=g.attributes.position;
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
      if(hood)shader.uniforms.drawcordColor={value:new T.Color(item.accent||'#96948e')};
      if(jerseyTexture){shader.uniforms.jerseyPrint={value:jerseyTexture};shader.uniforms.jerseyAccent={value:new T.Color(item.accent)};}

      shader.vertexShader='varying vec3 garmentPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngarmentPosition=position;');
      shader.fragmentShader=(jerseyTexture?'uniform sampler2D jerseyPrint; uniform vec3 jerseyAccent;\n':'')+(hood?'uniform vec3 drawcordColor;\n':'')+'varying vec3 garmentPosition;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        ${jerseyTexture?`float back=step(garmentPosition.z,-2.0);
        vec2 printUV=vec2((mix(garmentPosition.x,-garmentPosition.x,back)+9.)/18.,(garmentPosition.y-58.)/21.);
        if(printUV.x>=0.&&printUV.x<=1.&&printUV.y>=0.&&printUV.y<=1.){vec4 ink=texture2D(jerseyPrint,vec2(printUV.x*.5+back*.5,printUV.y));diffuseColor.rgb=mix(diffuseColor.rgb,ink.rgb,ink.a);}
        float stripe=step(18.,abs(garmentPosition.x))*(1.-step(20.,abs(garmentPosition.x)));diffuseColor.rgb=mix(diffuseColor.rgb,jerseyAccent,stripe);`:''}
        float fabricAA=1.-smoothstep(.3,1.,fwidth(garmentPosition.x*9.));
        float weave=sin((garmentPosition.x+garmentPosition.y)*55.)*sin(garmentPosition.y*43.);
        diffuseColor.rgb*=1.+${denim?'.12':'.035'}*weave*fabricAA;
        ${hood?`
        vec2 panel=vec2(abs(garmentPosition.x),garmentPosition.y);
        float front=smoothstep(3.0,6.0,garmentPosition.z);
        // Symmetric kangaroo pocket, angled openings, and two hanging cords.
        float pocketTop=66.4-max(0.,panel.x-3.7)*1.02;
        float pocket=front*(1.-smoothstep(7.2,7.6,panel.x))*smoothstep(58.5,59.0,panel.y)*(1.-smoothstep(pocketTop,pocketTop+.35,panel.y));
        float pocketStitch=pocket*(1.-smoothstep(.14,.40,min(pocketTop-panel.y,panel.y-59.0)));
        diffuseColor.rgb*=1.-pocket*.13+pocketStitch*.37;
        float cordX=1.65+.36*sin(panel.y*.48)+.05*(79.-panel.y);
        float cord=front*(1.-smoothstep(.16,.32,abs(panel.x-cordX)))*smoothstep(69.1,69.8,panel.y)*(1.-smoothstep(79.,79.6,panel.y));
        diffuseColor.rgb=mix(diffuseColor.rgb,drawcordColor*.67,cord*.89);
        float rib=max(1.-smoothstep(55.3,57.6,panel.y),smoothstep(30.5,32.1,panel.x));
        diffuseColor.rgb*=1.-rib*(.12+.09*sin((panel.x+garmentPosition.z)*14.)*fabricAA);
        `:''}
        ${style==='sweats'?`
        float outside=smoothstep(.54,.82,abs(garmentPosition.x)/max(length(garmentPosition.xz),.1));
        float stitch=(1.-smoothstep(.13,.43,abs(garmentPosition.z+2.4)))*outside;
        float knitCuff=1.-smoothstep(11.6,13.8,garmentPosition.y);
        diffuseColor.rgb*=1.+.21*stitch-knitCuff*(.17+.08*sin(garmentPosition.z*14.)*fabricAA);
        `:''}
        ${!top?`float seam=1.-smoothstep(.10,.26,abs(abs(garmentPosition.x)-7.));
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*${denim?'1.6':'.7'},seam*.4);
        float cuff=1.-smoothstep(11.,12.,garmentPosition.y);diffuseColor.rgb*=1.-cuff*.18;`:''}
      `);
    };
    material.customProgramCacheKey=()=>`garment-${style}`;
    const mesh=new T.SkinnedMesh(g,material);mesh.name=`Wardrobe ${style}`;mesh.position.copy(source.position);mesh.quaternion.copy(source.quaternion);mesh.scale.copy(source.scale);mesh.bindMode=source.bindMode;mesh.bind(source.skeleton,source.bindMatrix);createBodyShape(mesh)(player);mesh.castShadow=true;mesh.frustumCulled=false;source.parent.add(mesh);parts.push(mesh);
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
  return {apply(outfit,player){const next=outfit?[outfit.top.id,outfit.shorts.id,JSON.stringify(outfit.top.jersey),bodyMass(player)].join('|'):'';if(next===key)return;key=next;clear();if(outfit)for(const source of sources)for(const item of [outfit.top,outfit.shorts])garment(source,item,player);},dispose:clear};
}
