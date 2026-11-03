/** No auth credentials enter the game frame. Parent validates source + attempt token. */
const params = new URLSearchParams(globalThis.location?.search || '');
let sent = false;
function post(type, stats) {
  if (!params.get('bkArena') || !params.get('token') || window.parent === window) return;
  window.parent.postMessage({type, matchId:params.get('bkArena'), token:params.get('token'), drive:Number(params.get('drive')), stats}, location.origin);
}
export function reportArenaDrive(stats) { if(sent)return; sent=true; post('bk-arena-result',stats); }
export function exitArenaDrive() { post('bk-arena-exit'); }

// Keep broken renderer/back links from navigating the embedded iframe to Home.
// Let the parent decide whether to leave or recover the current drive.
if (typeof document !== 'undefined' && params.get('bkArena') && params.get('token') && window.parent !== window) {
  document.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link) return;
    const destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin || (destination.pathname !== '/' && destination.pathname !== '/index.html')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    exitArenaDrive();
  }, true);
}
