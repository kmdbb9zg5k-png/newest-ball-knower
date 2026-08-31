type FullCloudStateFlush = () => Promise<void>;
type CloudStateCommitted = (localKey: string, raw: string) => void;

let activeFullFlush: FullCloudStateFlush | null = null;
let activeCloudStateCommitted: CloudStateCommitted | null = null;

export function registerFullCloudStateFlush(flush: FullCloudStateFlush): () => void {
  activeFullFlush = flush;
  return () => {
    if (activeFullFlush === flush) activeFullFlush = null;
  };
}

export function registerCloudStateCommitted(markCommitted: CloudStateCommitted): () => void {
  activeCloudStateCommitted = markCommitted;
  return () => {
    if (activeCloudStateCommitted === markCommitted) activeCloudStateCommitted = null;
  };
}

export function markCloudStateCommitted(localKey: string, raw: string): void {
  activeCloudStateCommitted?.(localKey, raw);
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
