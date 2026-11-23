// The Blender mesh uses the reference rig's bind space. Its skin's joint
// names are remapped here so animation and controller coordinates stay shared.
export function uploadRunnerPrototype(gl, { json, accessor }, jointNames) {
 const primitive=json.meshes?.[0]?.primitives?.[0], skin=json.skins?.[0];
 if(!primitive||!skin||json.meshes[0].primitives.length!==1)throw Error('Invalid prototype mesh');
 const names=skin.joints.map(i=>json.nodes[i].name);
 const map=names.map(name=>jointNames.indexOf(name));
 if(map.some(i=>i<0))throw Error('Prototype joints do not match reference rig');
 const read=name=>{
  const i=primitive.attributes[name], meta=json.accessors[i], values=accessor(i);
  if(!meta.normalized)return values;
  const max={5120:127,5121:255,5122:32767,5123:65535}[meta.componentType];
  return Float32Array.from(values,value=>Math.max(-1,value/max));
 };
 const positions=read('POSITION'), normals=read('NORMAL'), weights=read('WEIGHTS_0');
 const joints=Uint8Array.from(read('JOINTS_0'),value=>map[value]);
 const ids=read('_BKREGION'),indices=accessor(primitive.indices),count=positions.length/3;
 if(ids.length!==count||normals.length!==positions.length||joints.length!==count*4||weights.length!==joints.length||
    !Number.isInteger(count)||count>32768||indices.length>90000||indices.some(i=>i>=count))throw Error('Invalid prototype geometry');
 const regions=new Float32Array(count*4);
 for(let i=0;i<count;i++){
  const material=ids[i], jersey=Number(material===1), pants=Number(material===2);
  if(!Number.isInteger(material)||material<0||material>9)throw Error('Invalid prototype material');
  regions.set([jersey,pants,Math.max(jersey,pants),material],i*4);
 }
 const vao=gl.createVertexArray();
 gl.bindVertexArray(vao);
 for(const [location,data,width] of [[0,positions,3],[1,normals,3],[3,joints,4],[4,weights,4],[6,regions,4]]){
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
  gl.enableVertexAttribArray(location);
  if(location===3)gl.vertexAttribIPointer(location,width,gl.UNSIGNED_BYTE,0,0);
  else gl.vertexAttribPointer(location,width,gl.FLOAT,false,0,0);
 }
 gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,gl.createBuffer());
 gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
 gl.bindVertexArray(null);
 return {vao,indexCount:indices.length,indexType:json.accessors[primitive.indices].componentType};
}
