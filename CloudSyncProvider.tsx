import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import { ensureOnlineSession, isCloudConfigured, supabase } from './supabase';
import { claimPendingGuestAccountMerge, hasPendingGuestAccountMerge } from './accountIdentity';
import { loadUserStates, saveUserStates, UserStateRow } from './userStateCloud';

type CloudSyncStatus = 'connecting' | 'online' | 'error' | 'unconfigured';
type CloudEnvelope = { raw: string | null };
type StorageEntry = { localKey: string; cloudKey: string; privateImages?: boolean };

const META_KEY = 'ballknower_cloud_meta_v1';
const OWNER_KEY = 'ballknower_cloud_owner_v1';
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

function cloudEnvelope(entry: StorageEntry, raw: string | null): CloudEnvelope | null {
  if (raw === null) return { raw: null };
  let safeRaw = raw;

  // A selfie and generated portrait stay on the device. Career attributes and
  // progress sync, but sensitive image data is never copied into a JSON table.
  if (entry.privateImages) {
    try {
      const profile = JSON.parse(raw);
      safeRaw = JSON.stringify({ ...profile, faceImage: '', renderImage: '' });
    } catch {
      return null;
    }
  }

  const envelope = { raw: safeRaw };
  if (JSON.stringify(envelope).length > MAX_CLOUD_RAW_LENGTH) {
    console.warn(`Cloud save skipped for ${entry.localKey}: state is too large.`);
    return null;
  }
  return envelope;
}

function applyRemote(entry: StorageEntry, envelope: CloudEnvelope): boolean {
  try {
    const before = localStorage.getItem(entry.localKey);
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
        const value = cloudEnvelope(entry, snapshots.get(entry.localKey) ?? null);
        return value ? [{ stateKey: entry.cloudKey, value }] : [];
      });

      writeChain = (async () => {
        if (!rows.length) throw new Error('Cloud save could not serialize the changed state.');
        const saved = await saveUserStates(rows);
        const savedAt = new Map(saved.map(row => [row.state_key, Date.parse(row.updated_at) || 0]));
        for (const entry of entries) {
          if (!savedAt.has(entry.cloudKey)) continue;
          if (localStorage.getItem(entry.localKey) !== snapshots.get(entry.localKey)) continue;
          dirtyKeys.delete(entry.localKey);
          meta[entry.localKey] = savedAt.get(entry.cloudKey) || meta[entry.localKey] || 0;
        }
        writeMeta(activeUserId, meta);
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

    const pullRemote = async (initial = false) => {
      const rows = await loadUserStates<CloudEnvelope>(CLOUD_STORAGE.map(entry => entry.cloudKey));
      const byKey = new Map(rows.map(row => [row.state_key, row]));
      const upload: StorageEntry[] = [];
      let restoredMountedState = false;

      for (const entry of CLOUD_STORAGE) {
        const row = byKey.get(entry.cloudKey) as UserStateRow<CloudEnvelope> | undefined;
        const localRaw = localStorage.getItem(entry.localKey);
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

    const bootstrap = async () => {
      const user = await ensureOnlineSession();
      activeUserId = user.id;
      const previousOwner = localStorage.getItem(OWNER_KEY);
      if (!user.is_anonymous && hasPendingGuestAccountMerge()) await claimPendingGuestAccountMerge(user);
      if (previousOwner && previousOwner !== activeUserId) {
        clearSyncedLocalState();
      }
      localStorage.setItem(OWNER_KEY, activeUserId);
      meta = readMeta(activeUserId);
      const handleIdentityChange = async (nextUser?: User) => {
        if (identitySwitchRunning) return;
        identitySwitchRunning = true;
        try {
          if (nextUser && hasPendingGuestAccountMerge()) await claimPendingGuestAccountMerge(nextUser);
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
