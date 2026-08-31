import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import { ensureOnlineSession, isCloudConfigured, supabase } from './supabase';
import { claimPendingGuestAccountMerge, hasPendingGuestAccountMerge } from './accountIdentity';
import { registerFullCloudStateFlush } from './cloudSyncCoordinator';
import { loadUserStates, saveUserStates, UserStateRow } from './userStateCloud';

type CloudSyncStatus = 'connecting' | 'online' | 'error' | 'unconfigured';
type CloudEnvelope = { raw: string | null };
type StorageEntry = {
  localKey: string;
  cloudKey: string;
  privateImages?: boolean;
  directJson?: boolean;
};

const META_KEY = 'ballknower_cloud_meta_v1';
const OWNER_KEY = 'ballknower_cloud_owner_v1';
export const OWNER_CLOUD_SYNC_EVENT = 'ballknower:owner-cloud-saved';
const MAX_CLOUD_RAW_LENGTH = 220_000;
const CLOUD_STORAGE: StorageEntry[] = [
  { localKey: 'ball-knower-favorite-team', cloudKey: 'favorite_team' },
  { localKey: 'ball-knower-team-setup-v2', cloudKey: 'favorite_team_setup' },
  { localKey: 'ballknower_solo_career_v1', cloudKey: 'solo_career' },
  { localKey: 'ballknower_solo_run_v1', cloudKey: 'solo_cap_run' },
  { localKey: 'ballknower_solo_fantasy_v1', cloudKey: 'solo_fantasy' },
  { localKey: 'ballknower_solo_fantasy_v1:season', cloudKey: 'solo_fantasy_season' },
  { localKey: 'ballknower_solo_real_team_v1', cloudKey: 'solo_real_team' },
  { localKey: 'ballknower_solo_real_team_v1:season', cloudKey: 'solo_real_team_season' },
  { localKey: 'ballknower_solo_my_player_v1', cloudKey: 'solo_my_player', privateImages: true },
  { localKey: 'ballknower_solo_my_player_v1:season', cloudKey: 'solo_my_player_season' },
  { localKey: 'ballknower_player_agent_v4', cloudKey: 'player_agent_career' },
  { localKey: 'ballknower_owner_career_v3', cloudKey: 'owner_business_career_v1', directJson: true },
];

const CloudSyncContext = createContext<CloudSyncStatus>(isCloudConfigured ? 'connecting' : 'unconfigured');

function metaKey(userId: string) {
  return `${META_KEY}:${userId}`;
}

function readMeta(userId: string): Record<string, number> {
  try {
    const value = JSON.parse(localStorage.getItem(metaKey(userId)) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function writeMeta(userId: string, meta: Record<string, number>) {
  try { localStorage.setItem(metaKey(userId), JSON.stringify(meta)); } catch {}
}

function directJsonRevision(entry: StorageEntry, value: string | unknown): number {
  if (!entry.directJson || value === null || value === undefined) return 0;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Math.max(0, Number((parsed as { cloudRevision?: unknown })?.cloudRevision) || 0);
  } catch {
    return 0;
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(item => stableJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function directJsonPayload(value: string | unknown): string {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return stableJson(parsed);
    const { cloudRevision: _cloudRevision, ...payload } = parsed as Record<string, unknown>;
    return stableJson(payload);
  } catch {
    return '';
  }
}

function cloudValue(entry: StorageEntry, raw: string | null): unknown {
  if (entry.directJson) {
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  if (raw === null) return { raw: null };
  let safeRaw = raw;

  // A selfie and generated portrait stay on the device. Career attributes and
  // progress sync, but sensitive image data is never copied into a JSON table.
  if (entry.privateImages) {
    try {
      const profile = JSON.parse(raw);
      safeRaw = JSON.stringify({ ...profile, faceImage: '', renderImage: '' });
    } catch {
      return undefined;
    }
  }

  const envelope = { raw: safeRaw };
  if (JSON.stringify(envelope).length > MAX_CLOUD_RAW_LENGTH) {
    console.warn(`Cloud save skipped for ${entry.localKey}: state is too large.`);
    return undefined;
  }
  return envelope;
}

function applyRemote(entry: StorageEntry, value: unknown): boolean {
  try {
    const before = localStorage.getItem(entry.localKey);
    if (entry.directJson) {
      if (value === null || value === undefined) localStorage.removeItem(entry.localKey);
      else localStorage.setItem(entry.localKey, JSON.stringify(value));
      return before !== localStorage.getItem(entry.localKey);
    }
    const envelope = value as CloudEnvelope;
    if (envelope?.raw === null) localStorage.removeItem(entry.localKey);
    else if (typeof envelope?.raw === 'string') {
      let restored = envelope.raw;
      if (entry.privateImages && before) {
        try {
          const localProfile = JSON.parse(before);
          const remoteProfile = JSON.parse(envelope.raw);
          restored = JSON.stringify({
            ...remoteProfile,
            faceImage: typeof localProfile?.faceImage === 'string' ? localProfile.faceImage : '',
            renderImage: typeof localProfile?.renderImage === 'string' ? localProfile.renderImage : '',
          });
        } catch {
          restored = envelope.raw;
        }
      }
      localStorage.setItem(entry.localKey, restored);
    }
    return before !== localStorage.getItem(entry.localKey);
  } catch (error) {
    console.warn(`Could not restore ${entry.localKey} from cloud`, error);
    return false;
  }
}

function clearSyncedLocalState() {
  for (const entry of CLOUD_STORAGE) localStorage.removeItem(entry.localKey);
}

export function useCloudSyncStatus() {
  return useContext(CloudSyncContext);
}

export const CloudSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<CloudSyncStatus>(isCloudConfigured ? 'connecting' : 'unconfigured');
  const [ready, setReady] = useState(!isCloudConfigured);
  const [syncRevision, setSyncRevision] = useState(0);

  useEffect(() => {
    if (!isCloudConfigured) return;
    let stopped = false;
    let localTimer = 0;
    let remoteTimer = 0;
    let retryTimer = 0;
    let activeUserId = '';
    let meta: Record<string, number> = {};
    const lastValues = new Map<string, string | null>();
    const dirtyKeys = new Set<string>();
    let writeChain: Promise<void> = Promise.resolve();
    let uploadRunning = false;
    let identitySwitchRunning = false;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const flushDirty = (): Promise<void> => {
      if (uploadRunning || dirtyKeys.size === 0) return writeChain;
      uploadRunning = true;
      const entries = CLOUD_STORAGE.filter(entry => dirtyKeys.has(entry.localKey));
      const snapshots = new Map(entries.map(entry => [entry.localKey, localStorage.getItem(entry.localKey)]));
      const rows = entries.flatMap(entry => {
        const value = cloudValue(entry, snapshots.get(entry.localKey) ?? null);
        return value !== undefined ? [{ stateKey: entry.cloudKey, value }] : [];
      });

      writeChain = (async () => {
        if (rows.length !== entries.length) throw new Error('Cloud save could not serialize every changed state.');
        const saved = await saveUserStates(rows);
        const savedByKey = new Map(saved.map(row => [row.state_key, row]));
        const submittedByKey = new Map(rows.map(row => [row.stateKey, row.value]));
        let restoredServerWinner = false;
        for (const entry of entries) {
          const savedRow = savedByKey.get(entry.cloudKey);
          if (!savedRow) continue;
          const snapshot = snapshots.get(entry.localKey) ?? null;
          const current = localStorage.getItem(entry.localKey);
          if (entry.directJson) {
            const submitted = submittedByKey.get(entry.cloudKey);
            const submittedRevision = directJsonRevision(entry, submitted);
            const savedRevision = directJsonRevision(entry, savedRow.value);
            const accepted =
              savedRevision === submittedRevision + 1 &&
              directJsonPayload(savedRow.value) === directJsonPayload(submitted);
            if (current !== snapshot && current) {
              // A newer same-tab action arrived after this upload began. Rebase
              // it onto whichever server revision won, even when the submitted
              // snapshot was stale, and leave the key dirty for the next pass.
              const rebased = {
                ...JSON.parse(current) as Record<string, unknown>,
                cloudRevision: savedRevision,
              };
              localStorage.setItem(entry.localKey, JSON.stringify(rebased));
              lastValues.set(entry.localKey, localStorage.getItem(entry.localKey));
              meta[entry.localKey] = Date.parse(savedRow.updated_at) || meta[entry.localKey] || 0;
              if (entry.localKey === 'ballknower_owner_career_v3') {
                window.dispatchEvent(new CustomEvent(OWNER_CLOUD_SYNC_EVENT, { detail: rebased }));
              }
              if (!accepted) console.warn('Owner cloud conflict rebased a newer local action for retry.');
              continue;
            }
            const directJsonChanged = applyRemote(entry, savedRow.value);
            if (accepted) {
              if (entry.localKey === 'ballknower_owner_career_v3') {
                window.dispatchEvent(new CustomEvent(OWNER_CLOUD_SYNC_EVENT, { detail: savedRow.value }));
              }
            } else {
              restoredServerWinner = directJsonChanged || restoredServerWinner;
            }
            lastValues.set(entry.localKey, localStorage.getItem(entry.localKey));
          } else if (current !== snapshot) {
            continue;
          }
          dirtyKeys.delete(entry.localKey);
          meta[entry.localKey] = Date.parse(savedRow.updated_at) || meta[entry.localKey] || 0;
        }
        writeMeta(activeUserId, meta);
        if (restoredServerWinner && !stopped) setSyncRevision(revision => revision + 1);
        if (!stopped && dirtyKeys.size === 0) setStatus('online');
      })()
        .catch(error => {
          console.warn('Ball Knower cloud save failed', error);
          if (!stopped) setStatus('error');
          throw error;
        })
        .finally(() => {
          uploadRunning = false;
          if (!stopped && dirtyKeys.size > 0) {
            window.clearTimeout(retryTimer);
            retryTimer = window.setTimeout(() => { void flushDirty().catch(() => undefined); }, 5_000);
          }
        });
      return writeChain;
    };

    const queueUpload = (changed: StorageEntry[]) => {
      for (const entry of changed) dirtyKeys.add(entry.localKey);
      void flushDirty().catch(() => undefined);
    };

    const captureLocalChanges = () => {
      const changed: StorageEntry[] = [];
      const changedAt = Date.now();
      for (const entry of CLOUD_STORAGE) {
        const current = localStorage.getItem(entry.localKey);
        if (lastValues.get(entry.localKey) === current) continue;
        lastValues.set(entry.localKey, current);
        meta[entry.localKey] = changedAt;
        changed.push(entry);
      }
      if (changed.length) {
        writeMeta(activeUserId, meta);
        queueUpload(changed);
      } else if (dirtyKeys.size > 0) {
        void flushDirty().catch(() => undefined);
      }
    };

    const flushAllLocalState = async () => {
      captureLocalChanges();
      while (dirtyKeys.size > 0) {
        await flushDirty();
        captureLocalChanges();
      }
    };
    const unregisterFullFlush = registerFullCloudStateFlush(flushAllLocalState);

    const pullRemote = async (initial = false) => {
      const rows = await loadUserStates<unknown>(CLOUD_STORAGE.map(entry => entry.cloudKey));
      const byKey = new Map(rows.map(row => [row.state_key, row]));
      const upload: StorageEntry[] = [];
      let restoredMountedState = false;

      for (const entry of CLOUD_STORAGE) {
        const row = byKey.get(entry.cloudKey) as UserStateRow<unknown> | undefined;
        const localRaw = localStorage.getItem(entry.localKey);
        if (entry.directJson) {
          const localRevision = directJsonRevision(entry, localRaw);
          const remoteRevision = row ? directJsonRevision(entry, row.value) : 0;
          const remoteRaw = row ? JSON.stringify(row.value) : null;
          if (dirtyKeys.has(entry.localKey)) {
            upload.push(entry);
          } else if (row && (localRaw === null || remoteRevision > localRevision)) {
            restoredMountedState = applyRemote(entry, row.value) || restoredMountedState;
            meta[entry.localKey] = Date.parse(row.updated_at) || 0;
          } else if (
            localRaw !== null &&
            (!row || remoteRevision < localRevision || remoteRaw !== localRaw)
          ) {
            upload.push(entry);
          }
          continue;
        }

        const localChangedAt = meta[entry.localKey] || 0;
        const remoteChangedAt = row ? Date.parse(row.updated_at) || 0 : 0;
        if (dirtyKeys.has(entry.localKey)) {
          upload.push(entry);
        } else if (initial && localRaw !== null && localChangedAt === 0) {
          meta[entry.localKey] = Date.now();
          upload.push(entry);
        } else if (row && remoteChangedAt >= localChangedAt) {
          restoredMountedState = applyRemote(entry, row.value) || restoredMountedState;
          meta[entry.localKey] = remoteChangedAt;
        } else if (localRaw !== null) {
          meta[entry.localKey] = Date.now();
          upload.push(entry);
        }
      }

      writeMeta(activeUserId, meta);
      for (const entry of CLOUD_STORAGE) lastValues.set(entry.localKey, localStorage.getItem(entry.localKey));
      if (upload.length) queueUpload(upload);
      if (!initial && restoredMountedState && !stopped) setSyncRevision(revision => revision + 1);
    };

    const startTimers = () => {
      if (!localTimer) localTimer = window.setInterval(captureLocalChanges, 800);
      if (!remoteTimer) remoteTimer = window.setInterval(() => {
        captureLocalChanges();
        void flushDirty()
          .then(() => pullRemote())
          .then(() => flushDirty())
          .then(() => { if (!stopped && dirtyKeys.size === 0) setStatus('online'); })
          .catch(error => {
            console.warn('Ball Knower cloud refresh failed', error);
            if (!stopped) setStatus('error');
          });
      }, 30_000);
    };

    const claimGuestStateOrContinue = async (user: User) => {
      if (!hasPendingGuestAccountMerge()) return;
      try {
        await claimPendingGuestAccountMerge(user);
      } catch (error) {
        // A terminal claim clears its pending token. Continue with the
        // permanent account normally; retryable failures keep the token and
        // must stop the identity switch so guest state is never discarded.
        if (hasPendingGuestAccountMerge()) throw error;
        console.warn('Guest progress claim can no longer be retried; continuing permanent-account sync', error);
      }
    };

    const bootstrap = async () => {
      const user = await ensureOnlineSession();
      activeUserId = user.id;
      const previousOwner = localStorage.getItem(OWNER_KEY);
      if (!user.is_anonymous) await claimGuestStateOrContinue(user);
      if (previousOwner && previousOwner !== activeUserId) {
        clearSyncedLocalState();
      }
      localStorage.setItem(OWNER_KEY, activeUserId);
      meta = readMeta(activeUserId);
      const handleIdentityChange = async (nextUser?: User) => {
        if (identitySwitchRunning) return;
        identitySwitchRunning = true;
        try {
          if (nextUser) await claimGuestStateOrContinue(nextUser);
          clearSyncedLocalState();
          if (nextUser) localStorage.setItem(OWNER_KEY, nextUser.id);
          else localStorage.removeItem(OWNER_KEY);
        } catch (error) {
          console.warn('Guest progress could not be attached to the permanent account yet', error);
          if (!stopped) setStatus('error');
        } finally {
          window.location.reload();
        }
      };
      const { data } = supabase!.auth.onAuthStateChange((_event, session) => {
        const nextUserId = session?.user?.id || '';
        if (!activeUserId || nextUserId === activeUserId) return;
        // Supabase warns against awaiting client calls inside the auth callback.
        // Defer the claim so token refresh/OAuth callbacks cannot deadlock.
        window.setTimeout(() => { void handleIdentityChange(session?.user); }, 0);
      });
      authSubscription = data.subscription;
      await pullRemote(true);
      await flushDirty();
    };

    void bootstrap()
      .then(() => {
        if (stopped) return;
        setStatus(dirtyKeys.size === 0 ? 'online' : 'error');
        setReady(true);
        startTimers();
      })
      .catch(error => {
        console.warn('Ball Knower cloud bootstrap failed', error);
        if (!stopped) {
          setStatus('error');
          setReady(true);
          // Never upload guest-local state under a new permanent UUID while a
          // prepared ownership claim is still pending. A later reload retries.
          if (!hasPendingGuestAccountMerge()) startTimers();
        }
      });

    return () => {
      stopped = true;
      window.clearInterval(localTimer);
      window.clearInterval(remoteTimer);
      window.clearTimeout(retryTimer);
      authSubscription?.unsubscribe();
      unregisterFullFlush();
    };
  }, []);

  if (!ready) {
    return <div className="grid min-h-[100dvh] place-items-center bg-[#07090d] px-6 text-center text-white">
      <div>
        <div className="mx-auto h-9 w-9 animate-spin text-[#D4AF37]"><Loader2 className="h-full w-full" /></div>
        <div className="mt-4 text-xs font-black uppercase tracking-[.24em] text-[#D4AF37]">Connecting your Ball Knower cloud</div>
        <p className="mt-2 text-xs text-zinc-500">Restoring leagues, careers, preferences, and saved seasons.</p>
      </div>
    </div>;
  }

  return <CloudSyncContext.Provider value={status}><React.Fragment key={syncRevision}>{children}</React.Fragment></CloudSyncContext.Provider>;
};

export const CloudSyncBadge: React.FC = () => {
  const status = useCloudSyncStatus();
  const online = status === 'online';
  const Icon = online ? Cloud : status === 'connecting' ? Loader2 : CloudOff;
  const label = online ? 'CLOUD SYNCED' : status === 'connecting' ? 'SYNCING' : status === 'error' ? 'SYNC RETRYING' : 'LOCAL ONLY';
  return <span className={`flex items-center gap-1 text-[10px] font-black ${online ? 'text-green-400' : 'text-amber-300'}`}>
    <span className={status === 'connecting' ? 'animate-spin' : ''}><Icon size={14} /></span> {label}
  </span>;
};
