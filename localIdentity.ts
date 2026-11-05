/** Browser-local identity only. Never use this fallback for auth, invitations or attempt tokens. */
type LocalCrypto={randomUUID?:()=>string;getRandomValues?:(bytes:Uint8Array)=>Uint8Array};
let sequence=0;
export function createLocalId(source:LocalCrypto|undefined=globalThis.crypto):string {
  try{if(typeof source?.randomUUID==='function')return source.randomUUID();}catch{/* Older webviews can expose unavailable secure-context APIs. */}
  try{
    if(typeof source?.getRandomValues==='function'){
      const bytes=source.getRandomValues(new Uint8Array(16));
      bytes[6]=(bytes[6]&0x0f)|0x40;bytes[8]=(bytes[8]&0x3f)|0x80;
      const hex=Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
      return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    }
  }catch{/* Local customization can still work without a browser crypto provider. */}
  sequence+=1;
  return `local-${Date.now().toString(36)}-${sequence.toString(36)}-${Math.random().toString(36).slice(2)}`;
}
