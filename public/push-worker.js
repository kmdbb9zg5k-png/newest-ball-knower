/* Push-only worker: no fetch handler, app cache, skipWaiting or forced reload. */
self.addEventListener('push',event=>{
  let payload;try{payload=event.data?.json();}catch{return;}
  if(!payload||typeof payload.notificationId!=='string'||!/^[a-f0-9-]{36}$/i.test(payload.notificationId)||!Number.isFinite(Date.parse(payload.expiresAt))||Date.parse(payload.expiresAt)<=Date.now())return;
  event.waitUntil(self.registration.showNotification(String(payload.title||'Ball Knower').slice(0,100),{
    body:String(payload.body||'').slice(0,240),icon:'/ball-knower-icon.svg',badge:'/ball-knower-icon.svg',tag:`bk-${payload.notificationId}`,renotify:false,
    data:{notificationId:payload.notificationId,expiresAt:payload.expiresAt},
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const {notificationId,expiresAt}=event.notification.data||{};
  if(typeof notificationId!=='string'||!/^[a-f0-9-]{36}$/i.test(notificationId)||Date.parse(expiresAt)<=Date.now())return;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const app=windows.find(client=>{const url=new URL(client.url);return url.origin===self.location.origin&&(url.pathname==='/'||url.pathname==='/index.html');});
    if(app){await app.focus();app.postMessage({type:'ballknower:push-open',notificationId});}
    else await self.clients.openWindow(`/?pushNotification=${encodeURIComponent(notificationId)}`);
  })());
});
