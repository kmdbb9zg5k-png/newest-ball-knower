import { Appearance, AppearancePlayer, CREATOR_EASTER_EGG_ID, FACE_SKIN, SOLO_ART_ROOT, UniformVariant, uniformFor } from './appearance';

const images = new Map<string,Promise<HTMLImageElement>>();
const ELI_FACE=`${SOLO_ART_ROOT}/creator/eli-face.webp`;
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

function drawHairAndFaceDetails(ctx:CanvasRenderingContext2D,look:Appearance) {
  const hair=['#18130f','#241a13','#0d0d0d','#36251b','#1c1714','#4a3323','#121212','#2a1c16','#5b3a24','#17110e'][look.hair]??'#17110e';
  ctx.save();
  ctx.fillStyle=hair;
  switch(look.hair){
    case 0: ctx.beginPath();ctx.ellipse(133,28,45,24,0,Math.PI,Math.PI*2);ctx.fill();break;
    case 1: for(let x=96;x<=170;x+=11){ctx.beginPath();ctx.arc(x,25+(x%3)*3,12,0,Math.PI*2);ctx.fill();}break;
    case 2: ctx.fillRect(91,9,84,26);ctx.beginPath();ctx.ellipse(133,20,43,24,0,0,Math.PI*2);ctx.fill();break;
    case 3: for(let x=96;x<=170;x+=14){ctx.fillRect(x,16,6,47);}break;
    case 4: ctx.beginPath();ctx.ellipse(133,25,47,28,0,0,Math.PI*2);ctx.fill();ctx.fillRect(88,25,12,27);break;
    case 5: ctx.beginPath();ctx.ellipse(133,15,38,17,0,0,Math.PI*2);ctx.fill();break;
    case 6: ctx.fillRect(94,8,78,16);break;
    case 7: for(let x=100;x<169;x+=9){ctx.beginPath();ctx.arc(x,18+(x%4)*4,8,0,Math.PI*2);ctx.fill();}break;
    case 8: ctx.beginPath();ctx.ellipse(133,20,45,21,0,0,Math.PI*2);ctx.fill();ctx.fillRect(89,18,10,33);ctx.fillRect(168,18,10,33);break;
    default: ctx.beginPath();ctx.ellipse(133,24,42,18,0,0,Math.PI*2);ctx.fill();
  }
  if(look.facialHair>0){
    ctx.fillStyle=hair;ctx.globalAlpha=.84;
    if(look.facialHair===1){ctx.fillRect(116,91,34,5);}
    else if(look.facialHair===2){ctx.beginPath();ctx.ellipse(133,112,17,12,0,0,Math.PI*2);ctx.fill();}
    else if(look.facialHair===3){ctx.fillRect(113,91,40,5);ctx.beginPath();ctx.ellipse(133,114,25,17,0,0,Math.PI*2);ctx.fill();}
    else if(look.facialHair===4){ctx.beginPath();ctx.ellipse(133,116,31,23,0,0,Math.PI*2);ctx.fill();}
    else {ctx.fillRect(111,91,44,5);ctx.beginPath();ctx.ellipse(133,113,20,13,0,0,Math.PI*2);ctx.fill();}
  }
  if(look.eyeBlack>0){
    ctx.globalAlpha=.8;ctx.fillStyle='#111';
    const width=look.eyeBlack===1?12:look.eyeBlack===2?17:22;
    ctx.fillRect(102-width/2,72,width,4);ctx.fillRect(164-width/2,72,width,4);
  }
  ctx.restore();
}

function drawGear(ctx:CanvasRenderingContext2D,look:Appearance,trim:string) {
  const sleeve=(left:boolean)=>{
    ctx.beginPath();
    if(left){ctx.moveTo(14,239);ctx.lineTo(57,249);ctx.lineTo(41,382);ctx.lineTo(7,380);}
    else {ctx.moveTo(242,239);ctx.lineTo(199,249);ctx.lineTo(215,382);ctx.lineTo(249,380);}
    ctx.closePath();ctx.fillStyle='#151b24';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=trim;ctx.stroke();
  };
  if(look.sleeves==='left'||look.sleeves==='both')sleeve(true);
  if(look.sleeves==='right'||look.sleeves==='both')sleeve(false);
  if(look.gloves!=='none'){
    ctx.save();ctx.fillStyle=look.gloves==='light'?'#e8e8e4':'#111820';ctx.strokeStyle=trim;ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(25,421,18,25,-.2,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.ellipse(231,421,18,25,.2,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
  }
}

/** Static 2D compositing only: shared tiny textures + deterministic vectors. No WebGL, video or runtime image generation. */
export async function drawCharacter(canvas:HTMLCanvasElement,player:AppearancePlayer,look:Appearance,variant:UniformVariant='home',helmet=false,isCurrent:()=>boolean=()=>true):Promise<void> {
  const creator=player.id===CREATOR_EASTER_EGG_ID;
  const [body,regions,faces,creatorFace]=await Promise.all([
    loadImage(`${SOLO_ART_ROOT}/body.webp`),loadImage(`${SOLO_ART_ROOT}/regions.webp`),loadImage(`${SOLO_ART_ROOT}/faces.webp`),
    creator?loadImage(ELI_FACE):Promise.resolve(null),
  ]);
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
  const jersey=rgb(uniform.jersey),pants=rgb(uniform.pants),skin=rgb(creator?'#9b654d':FACE_SKIN[look.face]);
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
  canvas.width=width;canvas.height=height;ctx.clearRect(0,0,width,height);
  if(creator&&creatorFace){
    ctx.save();ctx.beginPath();ctx.ellipse(133,83,58,82,0,0,Math.PI*2);ctx.clip();
    ctx.drawImage(creatorFace,0,0,creatorFace.naturalWidth,creatorFace.naturalHeight,75,0,116,165);ctx.restore();
  }else{
    const cellWidth=faces.naturalWidth/3,cellHeight=faces.naturalHeight/3;
    const faceX=(look.face%3)*cellWidth,faceY=Math.floor(look.face/3)*cellHeight;
    ctx.drawImage(faces,faceX,faceY,cellWidth,cellHeight,75,0,116,165);
    drawHairAndFaceDetails(ctx,look);
  }
  const scale=look.build==='heavy'?1.24:look.build==='power'?1.16:look.build==='lean'?.91:1;
  ctx.save();ctx.translate(128,0);ctx.scale(scale,1);ctx.translate(-128,0);
  ctx.drawImage(buffer,0,0);
  ctx.fillStyle=uniform.trim;
  const stripes=uniform.pattern%2===0?2:3;
  for(let stripe=0;stripe<stripes;stripe++){ctx.fillRect(20,166+stripe*10,29,4);ctx.fillRect(204,177+stripe*10,21,4);}
  if(uniform.pattern>=2){ctx.fillRect(67,148,4,34);ctx.fillRect(190,155,4,32);}
  ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.font='800 10px Arial, sans-serif';ctx.fillStyle=uniform.ink;
  const teamName=uniform.name.split(' ').at(-1)?.toUpperCase()??'BK';ctx.fillText(teamName,144,194,110);
  // Stroke + fill on the same transformed body keeps the number integrated with the jersey rather than looking pasted on.
  ctx.font='900 81px Impact, Arial Black, sans-serif';ctx.lineWidth=2.5;ctx.strokeStyle=uniform.trim;
  ctx.strokeText(String(look.number),145,293,117);ctx.fillText(String(look.number),145,293,117);
  drawGear(ctx,look,uniform.trim);ctx.restore();
  if(helmet){
    ctx.save();ctx.fillStyle=uniform.jersey;ctx.strokeStyle=uniform.trim;ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(77,77);ctx.bezierCurveTo(67,-14,184,-15,190,74);ctx.lineTo(181,124);ctx.lineTo(164,143);ctx.lineTo(169,87);ctx.bezierCurveTo(149,70,109,72,88,88);ctx.lineTo(91,119);ctx.lineTo(76,111);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle=uniform.trim;ctx.fillRect(128,1,7,67);ctx.strokeStyle='#bec4c9';ctx.lineWidth=4;ctx.lineJoin='round';
    ctx.beginPath();ctx.moveTo(80,92);ctx.lineTo(188,96);ctx.lineTo(178,136);ctx.lineTo(93,138);ctx.lineTo(80,92);ctx.moveTo(86,115);ctx.lineTo(184,118);ctx.moveTo(109,97);ctx.lineTo(115,139);ctx.moveTo(164,98);ctx.lineTo(158,138);ctx.stroke();ctx.restore();
  }
  buffer.width=0;buffer.height=0;
}
