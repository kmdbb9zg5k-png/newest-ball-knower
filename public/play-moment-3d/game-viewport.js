/** The canvas can finish resizing after window.resize on mobile browsers.
 * Reconcile layout before computing the camera projection, so the WebGL image
 * cannot keep a portrait/intermediate aspect ratio inside a landscape canvas.
 * This is called only by the two full-game modes; Combine is independent.
 */
export function syncGameViewport(renderer){
 const box=renderer.canvas.getBoundingClientRect();
 if(box.width<=0||box.height<=0)return false;
 if(Math.abs(renderer.width-box.width)<.01&&Math.abs(renderer.height-box.height)<.01)return false;
 renderer.resize();
 return true;
}
