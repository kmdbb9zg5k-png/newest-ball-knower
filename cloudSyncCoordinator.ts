type FullCloudStateFlush = () => Promise<void>;

let activeFullFlush: FullCloudStateFlush | null = null;

export function registerFullCloudStateFlush(flush: FullCloudStateFlush): () => void {
  activeFullFlush = flush;
  return () => {
    if (activeFullFlush === flush) activeFullFlush = null;
  };
}

export async function flushAllCloudState(): Promise<void> {
  if (!activeFullFlush) {
    throw new Error('Cloud save is still starting. Wait a moment and try again.');
  }
  await activeFullFlush();
}

export async function flushAllCloudStateBeforeIdentityChange(): Promise<void> {
  await flushAllCloudState();
}
