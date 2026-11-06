import {App} from '@capacitor/app';
import {Capacitor} from '@capacitor/core';
import {NativeAuthSession} from '@ball-knower/native-auth-session';
import {drawSquareProfilePhoto,canvasToProfilePhoto,validateProcessedProfilePhoto} from '../../profilePhoto';
import {initializeNativeAuthCallback,NATIVE_AUTH_RESULT_EVENT} from '../../nativeAuth';

declare global {interface Window {webkit:{messageHandlers:{bkNativeQA:{postMessage:(report:unknown)=>void}}}}}
const results:Array<{name:string;passed:boolean;detail?:string}>=[];
const callbacks:Array<{source:string;host:string;path:string;hasCode:boolean;hasImplicitToken:boolean}>=[];
let failedAuthCallbacks=0;
let exchanges=0;
let ready=false;
// Only the service boundary is substituted at build time. The production auth
// handler, file decoding, crop and JPEG validation run in the actual WKWebView.
(window as any).__bkNativeQAExchange=()=>{exchanges++};
function callback(source:string,value:string){
  const url=new URL(value);
  callbacks.push({source,host:url.host,path:url.pathname,hasCode:url.searchParams.has('code'),hasImplicitToken:new URLSearchParams(url.hash.slice(1)).has('access_token')});
  report();
}
function report(){
  const phase=callbacks.some(item=>item.source==='cold')?'cold':callbacks.length?'warm':'initial';
  const passed=ready&&results.length>=8&&results.every(item=>item.passed)&&exchanges===0;
  const status=passed?(phase==='cold'&&failedAuthCallbacks>0?'Cold callback rejected':phase==='warm'&&failedAuthCallbacks>0?'Warm callback rejected':'Native QA ready'):'Native QA running';
  const value={ready,phase,status,platform:Capacitor.getPlatform(),native:Capacitor.isNativePlatform(),results,callbacks,failedAuthCallbacks,exchanges};
  document.getElementById('phase-status')!.textContent=status;
  document.getElementById('report')!.textContent=JSON.stringify(value,null,2);
  window.webkit.messageHandlers.bkNativeQA.postMessage(value);
}
async function check(name:string,test:()=>unknown|Promise<unknown>){
  try{await test();results.push({name,passed:true})}catch(error){results.push({name,passed:false,detail:String(error)})}
  report();
}
function assert(value:unknown,message:string){if(!value)throw new Error(message)}
async function rejectedWith(task:Promise<unknown>,code:string){
  try{await task;throw new Error('The native bridge unexpectedly accepted invalid input')}catch(error){assert((error as {code?:string}).code===code,`Expected ${code}, received ${(error as {code?:string}).code||String(error)}`)}
}
window.addEventListener(NATIVE_AUTH_RESULT_EVENT,event=>{
  if((event as CustomEvent).detail?.status==='failed')failedAuthCallbacks++;
  report();
});
report();
await App.addListener('appUrlOpen',({url})=>callback('warm',url));
const launch=await App.getLaunchUrl();
if(launch?.url)callback('cold',launch.url);
await initializeNativeAuthCallback();
await check('real-ios-capacitor-bridge',()=>{
  assert(Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='ios','Expected the native iOS bridge');
  assert(Capacitor.isPluginAvailable('NativeAuthSession'),'Private plugin was not registered in the app');
  assert(Capacitor.isPluginAvailable('PushNotifications'),'Push plugin was not linked in the app');
});
await check('oauth-rejects-http',()=>rejectedWith(NativeAuthSession.authenticate({url:'http://gpnboygoosrmeydwjpvk.supabase.co/auth/v1/authorize'}),'AUTH_INVALID_URL'));
await check('oauth-rejects-untrusted-host',()=>rejectedWith(NativeAuthSession.authenticate({url:'https://example.invalid/auth/v1/authorize'}),'AUTH_INVALID_URL'));
await check('oauth-rejects-wrong-endpoint',()=>rejectedWith(NativeAuthSession.authenticate({url:'https://gpnboygoosrmeydwjpvk.supabase.co/auth/v1/token'}),'AUTH_INVALID_URL'));
await check('apple-deletion-rejects-invalid-nonce',()=>rejectedWith(NativeAuthSession.authorizeAppleForDeletion({nonce:'native-qa-invalid'}),'AUTH_NO_WINDOW'));
await check('uikit-warning-request-resolves',()=>NativeAuthSession.notifyGmEvent());
await check('wkwebview-photo-decode-crop-and-jpeg',async()=>{
  const source=document.createElement('canvas');source.width=1024;source.height=512;
  const context=source.getContext('2d')!;context.fillStyle='#ff0000';context.fillRect(0,0,512,512);context.fillStyle='#0000ff';context.fillRect(512,0,512,512);
  const png=await new Promise<Blob>((resolve,reject)=>source.toBlob(value=>value?resolve(value):reject(new Error('PNG encoding failed')),'image/png'));
  const canvas=document.createElement('canvas');
  await drawSquareProfilePhoto(canvas,new File([png],'native-qa.png',{type:'image/png'}),{zoom:1,x:100,y:50});
  const pixel=canvas.getContext('2d')!.getImageData(256,256,1,1).data;
  assert(pixel[2]>200&&pixel[0]<50,'The selected right-hand square was not cropped');
  const photo=await canvasToProfilePhoto(canvas);await validateProcessedProfilePhoto(photo);
  assert(photo.width===512&&photo.height===512&&photo.blob.type==='image/jpeg'&&photo.blob.size>0,'Expected a compressed 512 by 512 JPEG');
});
await check('wkwebview-rejects-corrupt-photo',async()=>{
  try{await validateProcessedProfilePhoto({blob:new Blob(['not a JPEG'],{type:'image/jpeg'}),width:512,height:512,mimeType:'image/jpeg',extension:'jpg'});throw new Error('Corrupt JPEG was accepted')}
  catch(error){assert(String(error).includes('not a valid JPEG'),'Unexpected corrupt-image error')}
});
ready=true;
report();
