// Retry context creation with a smaller framebuffer when the preferred GPU
// configuration is unavailable. Keep the same athlete, scene and gameplay.
export function createDrillRenderer(Renderer, options = {}) {
  try {
    return new Renderer({antialias: true, alpha: false, powerPreference: 'high-performance', ...options});
  } catch (preferredError) {
    try {
      return new Renderer({alpha: false, ...options, antialias: false, powerPreference: 'default'});
    } catch (cause) {
      throw new Error('Graphics context creation failed.', {cause});
    }
  }
}

// dispose() alone does not release the browser's WebGL context slot. Explicitly
// release it on exit/retry so repeated creator -> drill visits cannot accumulate
// live contexts while Safari waits for garbage collection.
export function releaseDrillRenderer(renderer) {
  if (!renderer) return;
  try { renderer.dispose(); }
  finally {
    try { renderer.forceContextLoss(); }
    finally { renderer.domElement.remove(); }
  }
}

export function combineStartupError(cause, stage) {
  if (cause?.combineStage) return cause;
  const error = new Error(`Combine startup failed at ${stage}.`, {cause});
  error.combineStage = stage;
  return error;
}

export function combineStartupMessage(error) {
  const stage = error?.combineStage || 'module';
  // Preserve the actual exception for developer diagnostics without exposing
  // raw URLs, saved athlete data or stack traces in the player-facing dialog.
  console.error(`[Combine startup: ${stage}]`, error);
  const messages = {
    graphics: 'The graphics engine could not start. Close another 3D game or tab, then tap Retry Drill. [BK-GRAPHICS]',
    athlete: 'Your athlete could not finish loading. Check your connection, then tap Retry Drill. [BK-ATHLETE]',
    background: 'The Combine scenery could not finish loading. Tap Retry Drill to try again. [BK-SCENERY]',
    field: 'The drill could not finish preparing. Tap Retry Drill to try again. [BK-FIELD]',
    module: 'The drill could not finish loading. Tap Retry Drill to try again. [BK-LOAD]',
    render: 'The graphics were interrupted while preparing the drill. Tap Retry Drill to try again. [BK-RENDER]',
  };
  return messages[stage] || messages.module;
}
