type FullCloudStateFlush = () => Promise<void>;

let activeFullFlush: FullCloudStateFlush | null = null;

export function registerFullCloudStateFlush(flush: FullCloudStateFlush): () => void {
  activeFullFlush = flush;
  return () => {
    if (activeFullFlush === flush) activeFullFlush = null;
  };
}

export async function flushAllCloudStateBeforeIdentityChange(): Promise<void> {
  if (!activeFullFlush) {
    throw new Error('Cloud save is still starting. Wait a moment and try signing in again.');
  }
  await activeFullFlush();
}
