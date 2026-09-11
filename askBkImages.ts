export const ASK_BK_MAX_IMAGES=5;
export const ASK_BK_MAX_ORIGINAL_BYTES=15*1024*1024;
export const ASK_BK_MAX_COMPRESSED_BYTES=600*1024;
export const ASK_BK_MAX_TOTAL_DATA_URL_CHARS=3_200_000;

export type AskBkAttachment={id:string;name:string;dataUrl:string;width:number;height:number;bytes:number};

const supportedTypes=new Set(['image/jpeg','image/png','image/webp','image/heic','image/heif']);
const supportedExtension=/\.(jpe?g|png|webp|heic|heif)$/i;

export function validateAskBkImageFile(file:Pick<File,'name'|'type'|'size'>){
  if(!supportedTypes.has(file.type.toLowerCase())&&!supportedExtension.test(file.name))throw new Error('Choose a JPG, PNG, WebP, HEIC, or HEIF screenshot.');
  if(file.size<=0)throw new Error(`${file.name||'That screenshot'} is empty.`);
  if(file.size>ASK_BK_MAX_ORIGINAL_BYTES)throw new Error(`${file.name||'That screenshot'} is over 15 MB.`);
}

const dataUrlBytes=(value:string)=>Math.ceil((value.length-(value.indexOf(',')+1))*3/4);

function loadImage(url:string){
  return new Promise<HTMLImageElement>((resolve,reject)=>{
    const image=new Image();
    image.decoding='async';
    image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error('That image format could not be opened on this device. Try saving it as a screenshot first.'));
    image.src=url;
  });
}

export async function compressAskBkImage(file:File):Promise<AskBkAttachment>{
  validateAskBkImageFile(file);
  const objectUrl=URL.createObjectURL(file);
  try{
    const image=await loadImage(objectUrl);
    const sourceWidth=image.naturalWidth||image.width;
    const sourceHeight=image.naturalHeight||image.height;
    if(!sourceWidth||!sourceHeight)throw new Error('That screenshot has no readable image data.');
    const canvas=document.createElement('canvas');
    let scale=Math.min(1,1600/Math.max(sourceWidth,sourceHeight));
    let quality=.8;
    let dataUrl='';
    for(let attempt=0;attempt<8;attempt++){
      canvas.width=Math.max(1,Math.round(sourceWidth*scale));
      canvas.height=Math.max(1,Math.round(sourceHeight*scale));
      const context=canvas.getContext('2d');
      if(!context)throw new Error('This device could not prepare that screenshot.');
      context.fillStyle='#090c12';context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(image,0,0,canvas.width,canvas.height);
      dataUrl=canvas.toDataURL('image/jpeg',quality);
      if(dataUrlBytes(dataUrl)<=ASK_BK_MAX_COMPRESSED_BYTES)break;
      if(quality>.54)quality-=.09;else scale*=.82;
    }
    const bytes=dataUrlBytes(dataUrl);
    if(!dataUrl.startsWith('data:image/jpeg;base64,')||bytes>ASK_BK_MAX_COMPRESSED_BYTES)throw new Error(`${file.name||'That screenshot'} could not be compressed enough. Crop it and try again.`);
    return{id:`ask-bk-image-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,name:file.name||'Screenshot',dataUrl,width:canvas.width,height:canvas.height,bytes};
  }finally{URL.revokeObjectURL(objectUrl)}
}

export async function compressAskBkImages(files:File[],existing:AskBkAttachment[]){
  if(existing.length+files.length>ASK_BK_MAX_IMAGES)throw new Error(`You can attach up to ${ASK_BK_MAX_IMAGES} screenshots at once.`);
  const additions:AskBkAttachment[]=[];
  for(const file of files)additions.push(await compressAskBkImage(file));
  const combined=[...existing,...additions];
  const total=combined.reduce((sum,image)=>sum+image.dataUrl.length,0);
  if(total>ASK_BK_MAX_TOTAL_DATA_URL_CHARS)throw new Error('Those screenshots are still too large together. Remove one and try again.');
  return combined;
}
