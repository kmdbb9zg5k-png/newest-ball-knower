/** No auth credentials enter the game frame. Parent validates source + attempt token. */
const params = new URLSearchParams(globalThis.location?.search || '');
let sent = false;
function post(type, stats) {
  if (!params.get('bkArena') || !params.get('token') || window.parent === window) return;
  window.parent.postMessage({type, matchId:params.get('bkArena'), token:params.get('token'), drive:Number(params.get('drive')), stats}, location.origin);
}
export function reportArenaDrive(stats) { if(sent)return; sent=true; post('bk-arena-result',stats); }
export function exitArenaDrive() { post('bk-arena-exit'); }
