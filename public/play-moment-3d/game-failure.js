/** Keep a failed field actionable, including when embedded in a head-to-head drive.
 * The parent uses the visible #error surface to recover the existing attempt.
 * Never navigate home, submit a result, or automatically start another drive here.
 */
export function showGameFailure(document, stage='runtime') {
 for(const id of ['loading','hud','paused','rotate']) {
  const node=document.getElementById(id);if(node)node.hidden=true;
 }
 const box=document.getElementById('error'),title=document.getElementById('errorTitle'),text=document.getElementById('errorText');
 if(title)title.textContent=stage==='graphics'?'Graphics interrupted':'The field needs to restart';
 if(text)text.textContent=stage==='graphics'
  ?'Your browser paused the graphics. Retry to reload this field.'
  :'The game stopped unexpectedly. Retry to reload this field.';
 if(box){box.hidden=false;box.setAttribute('data-failure',stage);}
 document.getElementById('retryGame')?.focus?.({preventScroll:true});
}
