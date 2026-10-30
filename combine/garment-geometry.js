import * as T from 'three';
import trousers from './casual-trousers.json';
export function trouserGeometry(){
 const decode=(s,Type)=>new Type(Uint8Array.from(atob(s),c=>c.charCodeAt(0)).buffer);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(Array.from(decode(trousers.position,Int16Array),n=>n/100),3));g.setIndex(new T.BufferAttribute(decode(trousers.index,Uint16Array),1));g.setAttribute('skinIndex',new T.BufferAttribute(decode(trousers.skinIndex,Uint16Array),4));g.setAttribute('skinWeight',new T.BufferAttribute(decode(trousers.skinWeight,Float32Array),4));g.computeVertexNormals();return g;
}
// Clip crossing triangles at the actual hem plane and interpolate bone weights.
export function clipGarment(source,planes){
 const p=source.attributes.position,n=source.attributes.normal,si=source.attributes.skinIndex,sw=source.attributes.skinWeight,idx=source.index,positions=[],normals=[],joints=[],weights=[];
 const vertex=i=>{const w=new Map();for(let k=0;k<4;k++){const bone=si.getComponent(i,k);w.set(bone,(w.get(bone)||0)+sw.getComponent(i,k));}return {p:new T.Vector3().fromBufferAttribute(p,i),n:new T.Vector3().fromBufferAttribute(n,i),w};};
 const mix=(a,b,t)=>{const w=new Map();for(const [bone,value] of a.w)w.set(bone,value*(1-t));for(const [bone,value] of b.w)w.set(bone,(w.get(bone)||0)+value*t);return {p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),w};};
 const emit=v=>{positions.push(...v.p);normals.push(...v.n);const w=[...v.w].sort((a,b)=>b[1]-a[1]).slice(0,4);while(w.length<4)w.push([0,0]);const total=w.reduce((sum,v)=>sum+v[1],0);for(const [bone,value] of w){joints.push(bone);weights.push(value/total);}};
 for(let i=0;i<(idx?.count||p.count);i+=3){let poly=[0,1,2].map(k=>vertex(idx?idx.getX(i+k):i+k));for(const plane of planes){const next=[];for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length],da=plane(a.p),db=plane(b.p);if(da>=0)next.push(a);if((da>=0)!==(db>=0))next.push(mix(a,b,da/(da-db)));}poly=next;if(!poly.length)break;}for(let j=1;j+1<poly.length;j++){emit(poly[0]);emit(poly[j]);emit(poly[j+1]);}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));return g;
}
