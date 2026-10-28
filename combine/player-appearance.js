import * as T from 'three';
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
  const points=[],coverage=[];
  for(const tri of triangles){
    let polygon=[];
    for(let i=0;i<3;i++){
      const a=tri[i],b=tri[(i+1)%3],da=field(a.p),db=field(b.p);
      if(da>=0)polygon.push(a);
      if((da>=0)!==(db>=0)){const t=da/(da-db);polygon.push({p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize()});}
    }
    const emit=a=>{const p=a.p.clone().addScaledVector(a.n,thickness(a.p));points.push(p.x,p.y,p.z);coverage.push(smooth(0,.45,field(a.p)));};
    for(let i=1;i+1<polygon.length;i++){emit(polygon[0]);emit(polygon[i]);emit(polygon[i+1]);}
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));geometry.setAttribute('bkCoverage',new T.Float32BufferAttribute(coverage,1));geometry.computeVertexNormals();return geometry;
}
function hairMaterial(color,density=1){
  const material=new T.MeshStandardMaterial({color,roughness:.94,metalness:0});
  material.onBeforeCompile=shader=>{
    shader.vertexShader='attribute float bkCoverage; varying float bkHairCoverage; varying vec3 bkHairPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbkHairPosition=position;bkHairCoverage=bkCoverage;');
    shader.fragmentShader='varying float bkHairCoverage; varying vec3 bkHairPosition;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float grain=fract(sin(dot(floor(bkHairPosition*38.0),vec3(12.9898,78.233,39.425)))*43758.5453);
      if(grain>bkHairCoverage*${density.toFixed(3)})discard;
      diffuseColor.rgb*=mix(.72,1.16,grain);`);
  };material.customProgramCacheKey=()=> 'combine-hair-grain-v2-'+density;return material;
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
    const vertices=[];
    for(let i=0;i<positions.count;i++){
      let influence=0;for(let k=0;k<4;k++)if(skinIndex.getComponent(i,k)===headIndex)influence+=weights.getComponent(i,k);
      vertices.push({p:new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(transform),n:new T.Vector3().fromBufferAttribute(normals,i).applyMatrix3(normalTransform).normalize(),influence});
    }
    for(let i=0;i<(indices?.count||positions.count);i+=3){const tri=[0,1,2].map(k=>vertices[indices?indices.getX(i+k):i+k]);if(tri.every(v=>v.influence>.5))triangles.push(tri);}
    for(const material of(Array.isArray(mesh.material)?mesh.material:[mesh.material])){
      const tint={value:new T.Vector3(1,1,1)},tattooCoverage={value:0},tattooStyle={value:0};skinUniforms.push({tint,tattooCoverage,tattooStyle});
      material.onBeforeCompile=shader=>{
        shader.uniforms.bkSkinTint=tint;shader.uniforms.bkTattooCoverage=tattooCoverage;shader.uniforms.bkTattooStyle=tattooStyle;
        shader.vertexShader='varying vec3 bkTattooPosition;\n'+shader.vertexShader.replace('#include <project_vertex>','bkTattooPosition=transformed;\n#include <project_vertex>');
        shader.fragmentShader='uniform vec3 bkSkinTint; uniform float bkTattooCoverage; uniform float bkTattooStyle; varying vec3 bkTattooPosition;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
          // Source exposed skin is warm/chromatic; kit and shoe pixels are
          // neutral. Dark tattoo ink/eyes remain untinted and retain contrast.
          float skinMask=smoothstep(.018,.09,diffuseColor.r-diffuseColor.b)
            *smoothstep(.008,.045,diffuseColor.g-diffuseColor.b)
            *smoothstep(.018,.065,max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b)));
          diffuseColor.rgb*=mix(vec3(1.0),bkSkinTint,skinMask);
          float arm=step(14.0,abs(bkTattooPosition.x))*smoothstep(31.0,39.0,bkTattooPosition.y)*(1.0-smoothstep(76.0,82.0,bkTattooPosition.y));
          float left=step(bkTattooPosition.x,0.0),both=step(5.5,bkTattooCoverage);
          float side=mix(left,1.0,both),vertical=1.0;
          if(bkTattooCoverage>1.5&&bkTattooCoverage<2.5)vertical=smoothstep(54.0,62.0,bkTattooPosition.y);
          if(bkTattooCoverage>2.5&&bkTattooCoverage<3.5)vertical=1.0-smoothstep(55.0,63.0,bkTattooPosition.y);
          if(bkTattooCoverage>3.5&&bkTattooCoverage<4.5)vertical=smoothstep(44.0,51.0,bkTattooPosition.y);
          float grain=.5+.5*sin(bkTattooPosition.y*(bkTattooStyle<.5?1.8:.72)+sin(bkTattooPosition.x*.58)*3.0);
          if(bkTattooStyle>.5&&bkTattooStyle<1.5)grain=step(.42,fract((abs(bkTattooPosition.x)+bkTattooPosition.y)*.19));
          if(bkTattooStyle>1.5&&bkTattooStyle<2.5)grain=smoothstep(.66,.9,sin(bkTattooPosition.y*.72+sin(bkTattooPosition.x*.24)*5.0));
          if(bkTattooStyle>2.5&&bkTattooStyle<3.5)grain=step(.52,.5+.5*sin(length(bkTattooPosition.xy)*.9));
          float ink=step(.5,bkTattooCoverage)*arm*side*vertical*mix(.42,1.0,grain);
          diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.27,ink*skinMask*.82);`).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
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
      };material.customProgramCacheKey=()=> 'combine-skin-knit-v2';material.needsUpdate=true;
    }
  });
  head.add(group);
  let currentKey='';
  function clear(){group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});group.clear();}
  function apply(player){
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
    if(!['bald','shaved'].includes(style)){
      const curls=/curl|afro/.test(style),locs=/loc|twist/.test(style),braids=/braid|cornrow/.test(style);
      const tall=/medium|long|afro/.test(style),length=curls?(tall?1.5:.65):locs?(tall?1.1:.55):braids?.12:/crop|crew/.test(style)?.38:.17;
      add(surfaceGeometry(triangles,p=>p.y-hairline(p),p=>{
        const fade=smooth(hairline(p),10.2,p.y),noise=.5+.5*Math.sin(p.x*13+p.z*4)*Math.sin(p.z*16-p.y*3);
        return .055+fade*length*(.65+.35*noise);
      }),'Scalp '+style);
      if(curls||locs){
        let seed=look.identitySeed;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
        const candidates=triangles.filter(t=>t.every(v=>v.p.y>hairline(v.p)+.4));
        const count=curls?850:100,geometry=new T.IcosahedronGeometry(1,1);geometry.setAttribute('bkCoverage',new T.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(1),1));const mesh=new T.InstancedMesh(geometry,material,count),dummy=new T.Object3D();
        for(let i=0;i<count;i++){
          const tri=candidates[Math.floor(random()*candidates.length)];const u=random(),w=random()*(1-u),p=tri[0].p.clone().multiplyScalar(1-u-w).addScaledVector(tri[1].p,u).addScaledVector(tri[2].p,w),n=tri[0].n.clone().add(tri[1].n).add(tri[2].n).normalize();
          const fade=smooth(hairline(p),10,p.y),radius=.12+fade*(curls?.26:.17),extent=locs?length*(.8+random()*.7):radius;
          dummy.position.copy(p).addScaledVector(n,.07+fade*length*.72);dummy.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),n);dummy.scale.set(radius,extent,radius);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
        }mesh.name='Hair strands '+style;mesh.castShadow=true;group.add(mesh);
      }
      if(braids){
        for(let x=-3;x<=3;x+=1){const f=Math.sqrt(1-x*x/23),points=[];for(let i=0;i<=20;i++){const a=.46+i/20*2.5;points.push(new T.Vector3(x,5.5+5.9*Math.sin(a)*f,1+6.1*Math.cos(a)*f));}add(new T.TubeGeometry(new T.CatmullRomCurve3(points),28,.14,5,false),'Braid');}
      }
    }
    if(look.facialHair!=='clean shaven'){
      const beard=look.facialHair,stubble=beard.includes('stubble'),goatee=beard==='goatee',mustache=beard==='mustache';
      const beardMaterial=hairMaterial(HAIR[look.hairColor],stubble?(beard==='light stubble'?.22:.4):.86);
      if(!mustache)add(surfaceGeometry(triangles,p=>Math.min(p.y+1.5,1.5+1.7*smooth(1.3,3.5,Math.abs(p.x))-p.y,p.z-1.6,4.15-Math.abs(p.x),goatee?1.65-Math.abs(p.x):10),()=>stubble?.045:beard==='full beard'?.20:.10),'Facial hair '+beard,beardMaterial);
      if(!stubble)add(surfaceGeometry(triangles,p=>Math.min(1.65-Math.abs(p.x),.22*(1-p.x*p.x/2.8)-Math.abs(p.y-(2.3-.08*Math.abs(p.x))),p.z-6.3),()=>.055),'Mustache',beardMaterial);
    }
    if(!group.children.length)material.dispose();
  }
  return {apply,dispose:clear};
}
