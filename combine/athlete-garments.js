import * as T from 'three';
import {clipGarment,trouserGeometry,topGeometry} from './garment-geometry.js';
import {bodyMass,createBodyShape} from './body-shape.js';

// Garments reuse the athlete's bind-space skin weights so sleeves and trouser
// legs bend with the existing animation rig, including customized body builds.
export function createAthleteGarments(body,showroom=false) {
  const sources=[];
  body.traverse(mesh=>{if(mesh.isSkinnedMesh)sources.push(mesh);});
  let key='',parts=[];
  function clear(){for(const mesh of parts){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.userData.jerseyTexture?.dispose();mesh.material.dispose();}parts=[];}
  function garment(source,item,player){
    const style=item.style;if(!style)return;
    const top=item.slot==='top',hood=style==='hoodie',short=style==='tee'||style==='jersey',denim=style==='jeans';
    const tunnel=item.id==='top-tunnel-fit'||item.id==='shorts-tunnel-fit';
    const detail=showroom&&tunnel;
    const length=short?21:34;
    const base=top?topGeometry():trouserGeometry();
    // Shape the fabric in bind space before clipping the hems, so the folds
    // follow the same skin weights as the surrounding cloth.
    if(hood||style==='sweats'){
      const {position,normal}=base.attributes;
      for(let i=0;i<position.count;i++){
        let x=position.getX(i),y=position.getY(i),z=position.getZ(i);
        const along=hood&&Math.abs(x)>18?Math.abs(x):y;
        const gather=hood?Math.max(Math.exp(-((y-57)**2)/11),Math.exp(-((Math.abs(x)-29)**2)/14)):Math.max(Math.exp(-((y-14)**2)/18),Math.exp(-((y-29)**2)/32));
        // Tailor the Tunnel Fit shell before applying the player's body build.
        // Taper around each limb's bind-space center to preserve cuff alignment.
        if(tunnel&&hood){
          const span=Math.abs(x);
          const hemEase=T.MathUtils.lerp(.46,1,T.MathUtils.smoothstep(y,54,60));
          const waist=hemEase*(1-T.MathUtils.smoothstep(y,60,74))*(1-T.MathUtils.smoothstep(span,13,18));
          const sleeve=T.MathUtils.smoothstep(span,17,31);
          const sleeveDepth=T.MathUtils.lerp(-3.5,-1.5,T.MathUtils.clamp((span-10)/24,0,1));
          x*=1-.14*waist;
          y=T.MathUtils.lerp(y,74.8,.23*sleeve);
          z=T.MathUtils.lerp(z,-1,.22*waist);
          z=T.MathUtils.lerp(z,sleeveDepth,.23*sleeve);
        }else if(tunnel){
          const hips=T.MathUtils.smoothstep(y,33,41)*(1-T.MathUtils.smoothstep(y,47,56.5));
          const leg=1-T.MathUtils.smoothstep(y,33,42);
          const legProgress=T.MathUtils.clamp((y-10)/29,0,1);
          const legCenter=Math.sign(x)*(8.6-2.3*legProgress);
          x=T.MathUtils.lerp(x,legCenter,.23*leg)*(1-.16*hips);
          z=T.MathUtils.lerp(z,-2.3+2.3*legProgress,.21*leg)*(1-.15*hips);
        }
        const fold=tunnel
          ?.15*gather*Math.sin(along*.95+z*.67+Math.abs(x)*.51)
          :.36*gather*(.5+.5*Math.sin(along*1.65+z*.36+x*.24));
        if(detail&&hood){
          const pocketTop=66.4-Math.max(0,Math.abs(x)-3.7)*1.02;
          const pocket=(1-T.MathUtils.smoothstep(Math.abs(x),6.9,7.6))*T.MathUtils.smoothstep(y,58.5,59.6)*(1-T.MathUtils.smoothstep(y,pocketTop-.7,pocketTop));
          z+=.36*pocket*T.MathUtils.smoothstep(z,3,5.2);
        }
        position.setXYZ(i,x+normal.getX(i)*fold,y+normal.getY(i)*fold,z+normal.getZ(i)*fold);
      }
      base.computeVertexNormals();
    }
    const g=top?clipGarment(base,[p=>length-p.x,p=>length+p.x]):base;
    if(top)base.dispose();
    const p=g.attributes.position;
    const material=new T.MeshStandardMaterial({color:item.color,roughness:detail?.81:denim?.93:.88,side:T.DoubleSide});
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
        ${detail?`
        // Triplanar yarn grain keeps the fabric detailed on the side as well as the front.
        vec3 knitCoord=garmentPosition*${hood?'vec3(7.4,9.2,6.7)':'vec3(5.8,11.8,8.1)'};
        vec3 knitAA=1.-smoothstep(vec3(.55),vec3(1.95),fwidth(knitCoord));
        vec3 yarn=sin(knitCoord+.6*sin(knitCoord.yzx*.19))*knitAA;
        float knit=(yarn.x*yarn.y+yarn.y*yarn.z+yarn.z*yarn.x)*${hood?'.075':'.053'};
        float slub=sin(garmentPosition.y*1.9+garmentPosition.z*.64)*sin(garmentPosition.x*2.1-garmentPosition.z*.8);
        diffuseColor.rgb*=1.07+knit+.052*slub;
        `:''}
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
        ${detail?`
        float pocketEdge=min(min(abs(panel.y-pocketTop),abs(panel.y-59.1)),abs(panel.x-7.15));
        float topstitch=pocket*(1.-smoothstep(.09,.24,pocketEdge))*smoothstep(-.3,.5,sin((panel.x+panel.y)*9.5));
        float pocketLip=front*smoothstep(4.1,4.7,panel.x)*(1.-smoothstep(7.15,7.5,panel.x))*(1.-smoothstep(.1,.58,abs(panel.y-pocketTop)));
        diffuseColor.rgb*=1.+topstitch*.68-pocketLip*.42;
        float eyeletRadius=length(vec2(panel.x-(1.65+.36*sin(79.*.48)),(panel.y-78.8)*1.06));
        float eyelet=front*(1.-smoothstep(.43,.6,eyeletRadius));
        float eyeletRing=eyelet*smoothstep(.2,.34,eyeletRadius);
        diffuseColor.rgb=mix(diffuseColor.rgb,drawcordColor*(.27+eyeletRing*.65),eyelet);
        float tip=cord*(1.-smoothstep(69.85,70.6,panel.y));
        diffuseColor.rgb=mix(diffuseColor.rgb,drawcordColor*1.45,tip);
        float shoulderY=panel.y-74.;
        float shoulderSeam=(1.-smoothstep(.1,.48,abs(panel.x-(14.+.065*shoulderY*shoulderY))))*smoothstep(69.,72.,panel.y);
        diffuseColor.rgb*=1.-shoulderSeam*.2+shoulderSeam*.39*smoothstep(.1,.85,sin((panel.y+garmentPosition.z)*8.));
        float ribColumns=mix(panel.x,garmentPosition.z,smoothstep(21.,27.,panel.x));
        float ribDetail=sin(ribColumns*8.)*(1.-smoothstep(.5,2.,fwidth(ribColumns*8.)));
        diffuseColor.rgb*=1.+rib*.23*ribDetail;
        // Small double-bar embroidery on the left chest, away from the cords.
        vec2 mark=vec2(garmentPosition.x-5.15+.38*(panel.y-73.4),panel.y-73.4);
        float embroidery=(1.-smoothstep(.55,.69,abs(mark.y)))*(1.-smoothstep(.13,.22,abs(abs(mark.x)-.4)))*front;
        diffuseColor.rgb=mix(diffuseColor.rgb,drawcordColor*(.85+.21*sin(mark.y*31.)),embroidery*.9);
        `:''}
        `:''}
        ${style==='sweats'?`
        float outside=smoothstep(.54,.82,abs(garmentPosition.x)/max(length(garmentPosition.xz),.1));
        float stitch=(1.-smoothstep(.13,.43,abs(garmentPosition.z+2.4)))*outside;
        float knitCuff=1.-smoothstep(11.6,13.8,garmentPosition.y);
        diffuseColor.rgb*=1.+.21*stitch-knitCuff*(.17+.08*sin(garmentPosition.z*14.)*fabricAA);
        ${detail?`
        vec3 cloth=garmentPosition;
        float outerPanel=smoothstep(8.8,10.9,abs(cloth.x));
        float pipedEdge=1.-smoothstep(.11,.36,abs(cloth.z+1.9+.035*(cloth.y-28.)));
        float seamLight=outerPanel*pipedEdge*smoothstep(12.,16.,cloth.y)*(1.-smoothstep(49.,54.,cloth.y));
        float dash=smoothstep(-.4,.7,sin(cloth.y*10.));
        diffuseColor.rgb*=1.+seamLight*(.2+.42*dash);
        float opening=smoothstep(1.6,3.6,cloth.z)*smoothstep(43.,45.,cloth.y)*(1.-smoothstep(50.,51.,cloth.y))
          *(1.-smoothstep(.12,.4,abs(abs(cloth.x)-(7.7+.38*(cloth.y-47.)))));
        diffuseColor.rgb*=1.-.43*opening;
        float ankleYarn=sin((cloth.x*.65+cloth.z)*8.5);
        diffuseColor.rgb*=1.+knitCuff*.19*ankleYarn*(1.-smoothstep(.5,2.,fwidth((cloth.x*.65+cloth.z)*8.5)));
        `:''}
        `:''}
        ${!top?`float seam=1.-smoothstep(.10,.26,abs(abs(garmentPosition.x)-7.));
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*${denim?'1.6':'.7'},seam*.4);
        float cuff=1.-smoothstep(11.,12.,garmentPosition.y);diffuseColor.rgb*=1.-cuff*.18;`:''}
      `);
    };
    material.customProgramCacheKey=()=>`garment-${style}-${detail}`;
    const mesh=new T.SkinnedMesh(g,material);mesh.name=`Wardrobe ${style}`;mesh.position.copy(source.position);mesh.quaternion.copy(source.quaternion);mesh.scale.copy(source.scale);mesh.bindMode=source.bindMode;mesh.bind(source.skeleton,source.bindMatrix);createBodyShape(mesh)(player);mesh.castShadow=true;mesh.frustumCulled=false;source.parent.add(mesh);parts.push(mesh);
    if(hood){
      // An open, folded hood behind the neck; a separate skinned piece gives
      // the hoodie an actual silhouette rather than a painted-on collar.
      const hoodGeometry=new T.SphereGeometry(1,24,16,0,Math.PI*2,Math.PI*.25,Math.PI*.65);
      hoodGeometry.scale(6.5,tunnel?5:6,tunnel?3.7:4.5);hoodGeometry.rotateX(-.8);hoodGeometry.translate(0,79,-5);
      const hp=hoodGeometry.attributes.position,skinIndex=[],skinWeight=[];
      for(let i=0;i<hp.count;i++){
        let best=0,distance=Infinity;
        for(let j=0;j<p.count;j+=24){const d=(p.getX(j)-hp.getX(i))**2+(p.getY(j)-76)**2+(p.getZ(j)+3)**2;if(d<distance){distance=d;best=j;}}
        for(let k=0;k<4;k++){skinIndex.push(g.attributes.skinIndex.getComponent(best,k));skinWeight.push(g.attributes.skinWeight.getComponent(best,k));}
      }
      hoodGeometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIndex,4));hoodGeometry.setAttribute('skinWeight',new T.Float32BufferAttribute(skinWeight,4));
      const hoodMaterial=material.clone();
      if(detail){hoodMaterial.onBeforeCompile=material.onBeforeCompile;hoodMaterial.customProgramCacheKey=material.customProgramCacheKey;}
      const hoodMesh=new T.SkinnedMesh(hoodGeometry,hoodMaterial);hoodMesh.name='Wardrobe folded hood';hoodMesh.position.copy(source.position);hoodMesh.quaternion.copy(source.quaternion);hoodMesh.scale.copy(source.scale);hoodMesh.bindMode=source.bindMode;hoodMesh.bind(source.skeleton,source.bindMatrix);hoodMesh.castShadow=true;hoodMesh.frustumCulled=false;source.parent.add(hoodMesh);parts.push(hoodMesh);
    }
  }
  return {apply(outfit,player){const next=outfit?[outfit.top.id,outfit.shorts.id,JSON.stringify(outfit.top.jersey),bodyMass(player)].join('|'):'';if(next===key)return;key=next;clear();if(outfit)for(const source of sources)for(const item of [outfit.top,outfit.shorts])garment(source,item,player);},dispose:clear};
}
