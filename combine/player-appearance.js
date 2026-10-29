import * as T from 'three';
import {outfitLook} from '../playerWardrobe.ts';
import {buildAthleteHair} from './athlete-hair.js';
import { simulatedPlayerIdentity } from '../solo/artIdentity.ts';

// Use the same immutable identity as Solo portraits; never seed by roster order,
// name, team, rating, current attempt or a random number.
export function combineAppearance(player) {
  const identity=simulatedPlayerIdentity(player.cosmeticIdentityId?{...player,id:player.cosmeticIdentityId}:player),custom=player.athleteAppearance;
  if(!custom)return identity;
  const tattooProfile=custom.tattooCoverage==='none'?'none':custom.tattooCoverage==='minimal'?'minimal':custom.tattooCoverage==='both-arms'?'both arms':custom.tattooCoverage==='half-sleeve'?'half sleeve':custom.tattooCoverage==='full-sleeve'?'full sleeve':'one arm';
  return {...identity,skinTone:custom.skinTone,hairStyle:custom.hairStyle,hairColor:custom.hairColor,facialHair:custom.facialHair,tattooProfile,tattooStyle:custom.tattooStyle,tattooCoverage:custom.tattooCoverage};
}
const SKIN = {
  'deep ebony':'#51352b','dark brown':'#684330','rich brown':'#805338',
  'medium brown':'#986340','warm brown':'#ae764e','olive brown':'#ac815b',
  'golden tan':'#c79265','light olive':'#c9a17c','warm beige':'#d8ad88','fair':'#e6bea2',
};
const HAIR={'black':'#14100e','dark brown':'#281b15','brown':'#4a2f21','auburn':'#653422','blond':'#977448'};
const smooth=(a,b,x)=>T.MathUtils.smoothstep(x,a,b);
const hairline=p=>3.7+4.15*smooth(-2,5.8,p.z)+.35*smooth(2.8,4.5,Math.abs(p.x));

// Clip the source head's actual surface against a curved hairline. This fits the
// skull/face rather than placing an ellipsoid or opaque helmet over the head.
function surfaceGeometry(triangles,field,thickness) {
  const points=[],coverage=[],normals=[];
  for(const tri of triangles){
    let polygon=[];
    for(let i=0;i<3;i++){
      const a=tri[i],b=tri[(i+1)%3],da=field(a.p),db=field(b.p);
      if(da>=0)polygon.push(a);
      if((da>=0)!==(db>=0)){const t=da/(da-db);polygon.push({p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize()});}
    }
    const emit=a=>{const p=a.p.clone().addScaledVector(a.n,thickness(a.p));points.push(p.x,p.y,p.z);normals.push(a.n.x,a.n.y,a.n.z);coverage.push(smooth(0,.45,field(a.p)));};
    for(let i=1;i+1<polygon.length;i++){emit(polygon[0]);emit(polygon[i]);emit(polygon[i+1]);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('bkCoverage',new T.Float32BufferAttribute(coverage,1));return geometry;
}
// Sample the actual upper lip: clipping only source triangle vertices loses
// a narrow mustache when the entire band falls inside large face triangles.
function mustacheGeometry(triangles){
  const points=[],normals=[],coverage=[],indices=[],cols=48,rows=10;
  const ray=new T.Ray(),hit=new T.Vector3(),direction=new T.Vector3(0,0,-1);
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const u=i/cols,v=j/rows,x=(u*2-1)*1.9,edge=Math.abs(x)/1.9;
    const center=1.80-.13*edge,half=.25*Math.sqrt(Math.max(0,1-edge*edge));
    const y=center+(v*2-1)*half;
    ray.set(new T.Vector3(x,y,20),direction);let nearest=null,normal=new T.Vector3(0,0,1);
    for(const tri of triangles)if(ray.intersectTriangle(tri[0].p,tri[1].p,tri[2].p,false,hit)&&hit.z>2.5&&(!nearest||hit.z>nearest.z)){
      nearest=hit.clone();normal.copy(tri[0].n).add(tri[1].n).add(tri[2].n).normalize();
    }
    const p=nearest||new T.Vector3(x,y,0);p.addScaledVector(normal,.09);
    points.push(p.x,p.y,p.z);normals.push(normal.x,normal.y,normal.z);
    coverage.push(nearest?Math.min(1,Math.min(u,1-u,v,1-v)*20):0);
    if(i<cols&&j<rows){const a=j*(cols+1)+i,b=a+1,c=a+cols+1;indices.push(a,b,c,b,c+1,c);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('bkCoverage',new T.Float32BufferAttribute(coverage,1));geometry.setIndex(indices);return geometry;
}
function hairMaterial(color,density=1){
  const material=new T.MeshStandardMaterial({color,roughness:.94,metalness:0});
  if(density<.5){material.transparent=true;material.opacity=density;material.depthWrite=false;}
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float bkCoverage; varying float bkHairCoverage; varying vec3 bkHairPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbkHairPosition=position;bkHairCoverage=bkCoverage;');
    shader.fragmentShader='varying float bkHairCoverage; varying vec3 bkHairPosition;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float grain=fract(sin(dot(floor(bkHairPosition*38.0),vec3(12.9898,78.233,39.425)))*43758.5453);
      if(bkHairCoverage<.025)discard;
      float strand=.5+.5*sin(bkHairPosition.x*135.0+bkHairPosition.z*95.0+sin(bkHairPosition.y*31.0)*2.0);
      diffuseColor.rgb*=mix(.85,1.12,strand)*mix(1.8,1.0,${density.toFixed(3)});`);
  };material.customProgramCacheKey=()=> 'combine-hair-strands-v4-'+density;return material;
}

export function createPlayerAppearance(body,bones) {
  const head=bones.Head,group=new T.Group();group.name='CombineHair';
  body.updateMatrixWorld(true);
  const headInverse=head.matrixWorld.clone().invert(),triangles=[],skinUniforms=[];
  body.traverse(mesh=>{
    if(!mesh.isSkinnedMesh)return;
    const geometry=mesh.geometry,indices=geometry.index,positions=geometry.attributes.position,normals=geometry.attributes.normal;
    const skinIndex=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight;
    const headIndex=mesh.skeleton.bones.indexOf(head),transform=headInverse.clone().multiply(mesh.matrixWorld),normalTransform=new T.Matrix3().getNormalMatrix(transform);
    const vertices=[],armMask=[];
    for(let i=0;i<positions.count;i++){
      let influence=0;for(let k=0;k<4;k++)if(skinIndex.getComponent(i,k)===headIndex)influence+=weights.getComponent(i,k);
      let arm=0;for(let k=0;k<4;k++)if(/(Arm|ForeArm|Hand)/.test(mesh.skeleton.bones[skinIndex.getComponent(i,k)]?.name||''))arm+=weights.getComponent(i,k);
      armMask.push(smooth(.15,.85,arm)*smooth(9,12,Math.abs(positions.getX(i))));
      vertices.push({p:new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(transform),n:new T.Vector3().fromBufferAttribute(normals,i).applyMatrix3(normalTransform).normalize(),influence});
    }
    geometry.setAttribute('bkArmSkin',new T.Float32BufferAttribute(armMask,1));
    for(let i=0;i<(indices?.count||positions.count);i+=3){const tri=[0,1,2].map(k=>vertices[indices?indices.getX(i+k):i+k]);if(tri.every(v=>v.influence>.5))triangles.push(tri);}
    for(const material of(Array.isArray(mesh.material)?mesh.material:[mesh.material])){
      const tint={value:new T.Vector3(1,1,1)},tattooCoverage={value:0},tattooStyle={value:0};
      const kit={enabled:{value:0},top:{value:new T.Color()},shorts:{value:new T.Color()},shoes:{value:new T.Color()},wrist:{value:new T.Color()},bands:{value:0},pattern:{value:0},accent:{value:new T.Color()}};
      skinUniforms.push({tint,tattooCoverage,tattooStyle,kit});
      material.onBeforeCompile=shader=>{
        for(const [name,uniform] of Object.entries(kit))shader.uniforms['bkKit_'+name]=uniform;
        shader.uniforms.bkSkinTint=tint;shader.uniforms.bkTattooCoverage=tattooCoverage;shader.uniforms.bkTattooStyle=tattooStyle;
        shader.vertexShader='attribute float bkArmSkin; varying float bkArmMask; varying vec3 bkTattooPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbkTattooPosition=position;bkArmMask=bkArmSkin;');
        shader.fragmentShader='uniform float bkKit_enabled; uniform vec3 bkKit_top; uniform vec3 bkKit_shorts; uniform vec3 bkKit_shoes; uniform vec3 bkKit_wrist; uniform float bkKit_bands; uniform float bkKit_pattern; uniform vec3 bkKit_accent; uniform vec3 bkSkinTint; uniform float bkTattooCoverage; uniform float bkTattooStyle; varying float bkArmMask; varying vec3 bkTattooPosition;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
          // The supplied model has permanent sleeve ink in its albedo. Replace
          // only exposed arm skin before applying optional ink. Bind-space
          // coordinates keep the selected pattern attached during animation.
          vec3 sourceSkin=diffuseColor.rgb;
          vec3 cleanSkin=vec3(.43966,.19807,.07036);
          float pores=.985+.015*sin(bkTattooPosition.x*54.0)*sin(bkTattooPosition.y*47.0);
          diffuseColor.rgb=mix(diffuseColor.rgb,cleanSkin*pores,bkArmMask);
          // Source exposed skin is warm/chromatic; kit and shoe pixels are
          // neutral. Dark tattoo ink/eyes remain untinted and retain contrast.
          float skinMask=smoothstep(.018,.09,diffuseColor.r-diffuseColor.b)
            *smoothstep(.008,.045,diffuseColor.g-diffuseColor.b)
            *smoothstep(.018,.065,max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b)));
          skinMask=max(skinMask,bkArmMask);
          diffuseColor.rgb*=mix(vec3(1.0),bkSkinTint,skinMask);
          float along=abs(bkTattooPosition.x);
          float arm=bkArmMask*(1.0-smoothstep(36.0,39.0,along));
          float left=step(bkTattooPosition.x,0.0),both=step(5.5,bkTattooCoverage);
          float side=mix(left,1.0,both),vertical=1.0;
          if(bkTattooCoverage<1.5)vertical=smoothstep(18.0,19.0,along)*(1.0-smoothstep(21.0,22.0,along));
          if(bkTattooCoverage>1.5&&bkTattooCoverage<2.5)vertical=1.0-smoothstep(22.0,24.0,along);
          if(bkTattooCoverage>2.5&&bkTattooCoverage<3.5)vertical=smoothstep(24.0,26.0,along);
          if(bkTattooCoverage>3.5&&bkTattooCoverage<4.5)vertical=1.0-smoothstep(26.0,28.0,along);
          // Preserve the source's detailed ink drawing for blackwork, while
          // geometric ink uses fine diamond outlines rather than broad bands.
          float sourceInk=1.0-smoothstep(.10,.32,sourceSkin.r);
          vec2 inkUV=vec2(along*.32,(bkTattooPosition.y+bkTattooPosition.z*.7)*.32);
          vec2 cell=abs(fract(vec2(inkUV.x+inkUV.y,inkUV.x-inkUV.y))-.5);
          float edge=min(cell.x,cell.y),aa=max(fwidth(edge),.012);
          float geometric=1.0-smoothstep(.035-aa,.035+aa,edge);
          float grain=sourceInk;
          if(bkTattooStyle>.5&&bkTattooStyle<1.5)grain=geometric;
          if(bkTattooStyle>1.5&&bkTattooStyle<2.5)grain=1.0-smoothstep(.07,.16,abs(sin(along*.8+sin(bkTattooPosition.y*.7)*2.0)));
          if(bkTattooStyle>2.5&&bkTattooStyle<3.5)grain=sourceInk;
          if(bkTattooStyle>3.5)grain=max(sourceInk,geometric*.65);
          float ink=step(.5,bkTattooCoverage)*arm*side*vertical*grain;
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.012,.018,.022),ink*.88);
          if(bkKit_enabled>.5){
            // Bind-space regions follow the skinned mesh. Limit recoloring to
            // neutral fabric pixels; preserve exposed skin, face and tattoos.
            float y=bkTattooPosition.y;
            float fabric=(1.-skinMask)*(1.-bkArmMask);
            float topMask=fabric*smoothstep(54.,55.,y)*(1.-smoothstep(79.,81.,y));
            float shortsMask=fabric*smoothstep(33.,35.,y)*(1.-smoothstep(54.,55.,y));
            float shoeMask=(1.-skinMask)*(1.-smoothstep(7.,9.,y));
            float shade=.58+.42*sqrt(clamp(dot(sourceSkin,vec3(.2126,.7152,.0722)),0.,1.));
            vec3 topColor=bkKit_top;
            float stripe=step(.72,fract((bkTattooPosition.x+y)*.13));
            topColor=mix(topColor,bkKit_accent,stripe*bkKit_pattern);
            diffuseColor.rgb=mix(diffuseColor.rgb,topColor*shade,topMask);
            diffuseColor.rgb=mix(diffuseColor.rgb,bkKit_shorts*shade,shortsMask);
            diffuseColor.rgb=mix(diffuseColor.rgb,bkKit_shoes*shade,shoeMask);
            float band=bkArmMask*smoothstep(33.8,34.1,along)*(1.-smoothstep(36.,36.3,along))*bkKit_bands;
            diffuseColor.rgb=mix(diffuseColor.rgb,bkKit_wrist*.85,band);
          }`).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
          // A soft skin response and dry compression fabric stay distinct under
          // the overhead banks; derivative-filtered knit avoids distant shimmer.
          roughnessFactor=mix(.92,.64,skinMask);
          #ifdef USE_MAP
          vec2 weaveUV=vMapUv*vec2(360.,420.);
          float weaveAA=1.-smoothstep(.35,1.2,max(fwidth(weaveUV.x),fwidth(weaveUV.y)));
          float weave=sin(weaveUV.x*6.283)*sin(weaveUV.y*6.283);
          diffuseColor.rgb*=1.+.025*weave*weaveAA*(1.-skinMask);
          #endif
        `);
      };material.customProgramCacheKey=()=> 'combine-custom-skin-wardrobe-v1';material.needsUpdate=true;
    }
  });
  head.add(group);
  let currentKey='';
  function clear(){group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});group.clear();}
  function apply(player){
    const outfit=player.wardrobe?outfitLook(player.wardrobe):null;
    for(const u of skinUniforms){u.kit.enabled.value=outfit?1:0;if(outfit){for(const slot of ['top','shorts','shoes','wrist'])u.kit[slot].value.set(outfit[slot].color);u.kit.bands.value=outfit.wrist.id==='wrist-none'?0:1;u.kit.pattern.value=outfit.top.pattern?1:0;u.kit.accent.value.set(outfit.top.accent||outfit.top.color);}}
    const look=combineAppearance(player),key=[look.skinTone,look.hairStyle,look.hairColor,look.facialHair,look.tattooProfile,look.tattooStyle,look.tattooCoverage].join('|');
    body.userData.playerId=player.id;body.userData.playerName=player.name;body.userData.appearance=look;
    if(currentKey===key)return;currentKey=key;
    const reference=new T.Color('#b17b4b'),color=new T.Color(SKIN[look.skinTone]);
    const coverageCodes={none:0,minimal:1,'upper-arm':2,forearm:3,'half-sleeve':4,'full-sleeve':5,'both-arms':6};
    const styleCodes={blackwork:0,geometric:1,script:2,traditional:3,mixed:4};
    const coverage=look.tattooCoverage||({none:'none',minimal:'minimal','one arm':'upper-arm','half sleeve':'half-sleeve','full sleeve':'full-sleeve','both arms':'both-arms'}[look.tattooProfile]||'none');
    for(const u of skinUniforms){u.tint.value.set(color.r/reference.r,color.g/reference.g,color.b/reference.b);u.tattooCoverage.value=coverageCodes[coverage]??0;u.tattooStyle.value=styleCodes[look.tattooStyle]??4;}
    clear();const material=hairMaterial(HAIR[look.hairColor]);
    function add(geometry,name,mat=material){if(!geometry.attributes.position?.count){geometry.dispose();return;}if(!geometry.attributes.bkCoverage)geometry.setAttribute('bkCoverage',new T.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(1),1));const mesh=new T.Mesh(geometry,mat);mesh.name=name;mesh.castShadow=true;group.add(mesh);}
    const style=look.hairStyle;
    buildAthleteHair({style,triangles,material,surfaceGeometry,seed:look.identitySeed,add:(geometry,name,mat)=>{if(geometry.isMesh){group.add(geometry);return;}add(geometry,name,mat);}});
    if(look.facialHair!=='clean shaven'){
      const beard=look.facialHair,stubble=beard.includes('stubble'),goatee=beard==='goatee',mustache=beard==='mustache';
      const beardMaterial=hairMaterial(HAIR[look.hairColor],stubble?(beard==='light stubble'?.22:.4):.86);
      if(!mustache)add(surfaceGeometry(triangles,p=>Math.min(p.y+1.5,1.5+1.7*smooth(1.3,3.5,Math.abs(p.x))-p.y,p.z-1.0,4.35-Math.abs(p.x),goatee?1.65-Math.abs(p.x):10,Math.max(Math.abs(p.x)/1.5,Math.abs(p.y-1.3)/.55)-1),p=>stubble?.025:beard==='full beard'?.25+.6*(1-smooth(-1.5,2,p.y)):.12),'Facial hair '+beard,beardMaterial);
      add(mustacheGeometry(triangles),'Mustache',beardMaterial);
    }
    if(!group.children.length)material.dispose();
    // Fine tapered fibers break up beard edges without stochastic pixel holes.
    for(const beardSurface of group.children.filter(mesh=>mesh.name.startsWith('Facial hair')||mesh.name==='Mustache'))if(!look.facialHair.includes('stubble')){
      const p=beardSurface.geometry.attributes.position,n=beardSurface.geometry.attributes.normal;
      const fiber=new T.ConeGeometry(.018,.17,3);fiber.setAttribute('bkCoverage',new T.Float32BufferAttribute(new Float32Array(fiber.attributes.position.count).fill(1),1));
      const count=Math.min(2400,p.count),fibers=new T.InstancedMesh(fiber,beardSurface.material,count),dummy=new T.Object3D();
      for(let i=0;i<count;i++){
        const j=(i*7919)%p.count,normal=new T.Vector3().fromBufferAttribute(n,j);
        dummy.position.fromBufferAttribute(p,j).addScaledVector(normal,.025);
        dummy.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),normal.add(new T.Vector3(0,-1,.1)).normalize());
        dummy.updateMatrix();fibers.setMatrixAt(i,dummy.matrix);
      }
      fibers.name='Beard fibers';group.add(fibers);
    }
  }
  return {apply,dispose:clear};
}
