import { Appearance, AppearancePlayer, FACE_SKIN, SOLO_ART_ROOT, UniformVariant, uniformFor } from './appearance';

const images = new Map<string,Promise<HTMLImageElement>>();
function loadImage(path: string): Promise<HTMLImageElement> {
  let promise = images.get(path);
  if (!promise) {
    promise = new Promise((resolve,reject)=>{
      const image = new Image();
      image.onload=()=>resolve(image);
      image.onerror=()=>{images.delete(path);reject(new Error('Character artwork could not be loaded.'));};
      image.src=path;
    });
    images.set(path,promise);
  }
  return promise;
}
const rgb=(hex:string)=>[1,3,5].map(offset=>parseInt(hex.slice(offset,offset+2),16));
const clamp=(n:number)=>Math.max(0,Math.min(255,Math.round(n)));

/** A single static 2D composite. No WebGL, continuous render loop, video or image API. */
export async function drawCharacter(canvas:HTMLCanvasElement,player:AppearancePlayer,look:Appearance,variant:UniformVariant='home',helmet=false,isCurrent:()=>boolean=()=>true):Promise<void> {
  const [body,regions,faces]=await Promise.all(['body.webp','regions.webp','faces.webp'].map(file=>loadImage(`${SOLO_ART_ROOT}/${file}`)));
  if(!isCurrent())return;
  const width=256,height=768;
  const buffer=document.createElement('canvas');buffer.width=width;buffer.height=height;
  const draw=buffer.getContext('2d',{willReadFrequently:true});
  const ctx=canvas.getContext('2d');
  if(!draw||!ctx)throw new Error('Character preview is unavailable on this device.');
  draw.drawImage(body,0,0,width,height);
  const pixels=draw.getImageData(0,0,width,height);
  draw.clearRect(0,0,width,height);draw.drawImage(regions,0,0,width,height);
  const mask=draw.getImageData(0,0,width,height).data;
  const uniform=uniformFor(player,variant);
  const jersey=rgb(uniform.jersey),pants=rgb(uniform.pants),skin=rgb(FACE_SKIN[look.face]);
  for(let index=0;index<pixels.data.length;index+=4){
    if(pixels.data[index+3]===0)continue;
    const luminance=(pixels.data[index]*.2126+pixels.data[index+1]*.7152+pixels.data[index+2]*.0722)/255;
    const region=mask[index]>127?'jersey':mask[index+1]>127?'pants':mask[index+2]>127?'skin':null;
    if(!region)continue;
    const color=region==='jersey'?jersey:region==='pants'?pants:skin;
    const intensity=region==='skin'?(.3+luminance*2.3):region==='jersey'?(.32+luminance*1.45):(.28+luminance*1.55);
    for(let channel=0;channel<3;channel++)pixels.data[index+channel]=clamp(color[channel]*intensity);
  }
  draw.clearRect(0,0,width,height);draw.putImageData(pixels,0,0);
  if(!isCurrent())return;
  canvas.width=width;canvas.height=height;
  ctx.clearRect(0,0,width,height);
  // Neck is tucked behind the uniform. A trade changes the kit, never this face index.
  const cellWidth=faces.naturalWidth/3,cellHeight=faces.naturalHeight/3;
  const faceX=(look.face%3)*cellWidth,faceY=Math.floor(look.face/3)*cellHeight;
  ctx.drawImage(faces,faceX,faceY,cellWidth,cellHeight,75,0,116,165);
  const scale=look.build==='power'?1.16:look.build==='lean'?.91:1;
  ctx.save();ctx.translate(128,0);ctx.scale(scale,1);ctx.translate(-128,0);
  ctx.drawImage(buffer,0,0);
  ctx.fillStyle=uniform.trim;
  const stripes=uniform.pattern%2===0?2:3;
  for(let stripe=0;stripe<stripes;stripe++){
    ctx.fillRect(20,166+stripe*10,29,4);ctx.fillRect(204,177+stripe*10,21,4);
  }
  if(uniform.pattern>=2){ctx.fillRect(67,148,4,34);ctx.fillRect(190,155,4,32);}
  ctx.textAlign='center';ctx.textBaseline='alphabetic';
  ctx.font='800 10px Arial, sans-serif';ctx.fillStyle=uniform.ink;
  const teamName=uniform.name.split(' ').at(-1)?.toUpperCase()??'BK';
  ctx.fillText(teamName,144,194,110);
  ctx.font='900 81px Impact, Arial Black, sans-serif';ctx.lineWidth=2.5;ctx.strokeStyle=uniform.trim;
  ctx.strokeText(String(look.number),145,293,117);ctx.fillText(String(look.number),145,293,117);
  if(look.sleeves==='both'){
    ctx.beginPath();ctx.moveTo(14,239);ctx.lineTo(57,249);ctx.lineTo(41,382);ctx.lineTo(7,380);ctx.closePath();
    ctx.fillStyle='#151b24';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=uniform.trim;ctx.stroke();
  }
  ctx.restore();
  if(helmet){
    ctx.save();ctx.fillStyle=uniform.jersey;ctx.strokeStyle=uniform.trim;ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(77,77);ctx.bezierCurveTo(67,-14,184,-15,190,74);ctx.lineTo(181,124);ctx.lineTo(164,143);ctx.lineTo(169,87);ctx.bezierCurveTo(149,70,109,72,88,88);ctx.lineTo(91,119);ctx.lineTo(76,111);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle=uniform.trim;ctx.fillRect(128,1,7,67);
    ctx.strokeStyle='#bec4c9';ctx.lineWidth=4;ctx.lineJoin='round';
    ctx.beginPath();ctx.moveTo(80,92);ctx.lineTo(188,96);ctx.lineTo(178,136);ctx.lineTo(93,138);ctx.lineTo(80,92);ctx.moveTo(86,115);ctx.lineTo(184,118);ctx.moveTo(109,97);ctx.lineTo(115,139);ctx.moveTo(164,98);ctx.lineTo(158,138);ctx.stroke();ctx.restore();
  }
  buffer.width=0;buffer.height=0;
}
