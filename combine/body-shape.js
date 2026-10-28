import * as T from 'three';

export function bodyMass(build){
  const bmi=(build.weightLbs||195)*703/((build.heightInches||72)**2);
  return T.MathUtils.clamp(Math.max(((build.bodyBuild??50)-65)/35,(bmi-27)/13),0,1);
}

// Deform the original bind mesh, including its clothing, so mass changes the
// silhouette from every angle and remains attached to the animated skeleton.
export function createBodyShape(body){
  const meshes=[];
  body.traverse(mesh=>{if(mesh.isSkinnedMesh)meshes.push({mesh,base:mesh.geometry.attributes.position.array.slice(),normals:mesh.geometry.attributes.normal.array.slice()});});
  let previous=-1;
  return build=>{
    const mass=bodyMass(build);if(mass===previous)return;previous=mass;
    for(const {mesh,base,normals} of meshes){
      const g=mesh.geometry,p=g.attributes.position,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
      for(let i=0;i<p.count;i++){
        const x=base[i*3],y=base[i*3+1],z=base[i*3+2];
        let torso=0,limb=0;
        for(let k=0;k<4;k++){
          const name=mesh.skeleton.bones[si.getComponent(i,k)].name,w=sw.getComponent(i,k);
          if(/Hips|Spine/.test(name))torso+=w;
          if(/UpLeg|ForeArm|Arm/.test(name))limb+=w;
        }
        const belly=Math.exp(-(((y-56)/11)**2))*torso;
        const chest=Math.exp(-(((y-69)/10)**2))*torso;
        const front=T.MathUtils.smoothstep(z,-2,5);
        const nx=x*(1+mass*(belly*.65+chest*.28));
        const nz=z+mass*(front*(belly*10+chest*3)-(1-front)*belly*3);
        p.setXYZ(i,nx+normals[i*3]*limb*mass*1.4,y,nz+normals[i*3+2]*limb*mass*1.4);
      }
      p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingSphere();
    }
  };
}
