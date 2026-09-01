type FullCloudStateFlush = () => Promise<void>;
type CloudStateCommitted = (localKey: string, fingerprint: string) => void;

const CLOUD_STATE_COMMITTED_MARKER_KEY = 'ballknower_cloud_committed_marker_v1';
const AGENT_PENDING_SIGNING_KEY = 'ballknower_player_agent_signing_pending_v1';
let activeFullFlush: FullCloudStateFlush | null = null;
let activeCloudStateCommitted: CloudStateCommitted | null = null;

function hasValidPendingAgentSigning(): boolean {
  if (typeof localStorage === 'undefined') return false;
  const raw = localStorage.getItem(AGENT_PENDING_SIGNING_KEY);
  if (!raw) return false;
  try {
    const pending = JSON.parse(raw) as { userId?: unknown; beforeState?: unknown; state?: unknown };
    if (
      typeof pending.userId === 'string' &&
      pending.userId &&
      pending.beforeState &&
      typeof pending.beforeState === 'object' &&
      pending.state &&
      typeof pending.state === 'object'
    ) {
      return true;
    }
  } catch {}
  localStorage.removeItem(AGENT_PENDING_SIGNING_KEY);
  return false;
}

export function cloudStateFingerprint(raw: string): string {
  let hash = 2166136261;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${raw.length}:${(hash >>> 0).toString(16)}`;
}

export function registerFullCloudStateFlush(flush: FullCloudStateFlush): () => void {
  activeFullFlush = flush;
  return () => {
    if (activeFullFlush === flush) activeFullFlush = null;
  };
}

export function registerCloudStateCommitted(markCommitted: CloudStateCommitted): () => void {
  activeCloudStateCommitted = markCommitted;
  const onStorage = (event: StorageEvent) => {
    if (event.key !== CLOUD_STATE_COMMITTED_MARKER_KEY || !event.newValue) return;
    try {
      const marker = JSON.parse(event.newValue) as { localKey?: unknown; fingerprint?: unknown };
      if (typeof marker.localKey === 'string' && typeof marker.fingerprint === 'string') {
        markCommitted(marker.localKey, marker.fingerprint);
      }
    } catch {}
  };
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('storage', onStorage);
    if (activeCloudStateCommitted === markCommitted) activeCloudStateCommitted = null;
  };
}

export function markCloudStateCommitted(localKey: string, raw: string): void {
  const fingerprint = cloudStateFingerprint(raw);
  activeCloudStateCommitted?.(localKey, fingerprint);
  try {
    localStorage.setItem(
      CLOUD_STATE_COMMITTED_MARKER_KEY,
      JSON.stringify({ localKey, fingerprint, nonce: `${Date.now()}:${Math.random()}` }),
    );
  } catch {}
}

export async function flushAllCloudState(): Promise<void> {
  if (!activeFullFlush) {
    throw new Error('Cloud save is still starting. Wait a moment and try again.');
  }
  await activeFullFlush();
}

export async function flushAllCloudStateBeforeIdentityChange(): Promise<void> {
  if (hasValidPendingAgentSigning()) {
    throw new Error('Finish verifying the pending Agent signing before changing accounts.');
  }
  await flushAllCloudState();
}
