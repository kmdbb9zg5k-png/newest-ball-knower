import React, { createContext, useContext, useEffect, useState } from 'react';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import { isCloudConfigured } from './supabase';
import { loadUserStates, saveUserStates, UserStateRow } from './userStateCloud';

type CloudSyncStatus = 'connecting' | 'online' | 'error' | 'unconfigured';
type CloudEnvelope = { raw: string | null };
type StorageEntry = { localKey: string; cloudKey: string; privateImages?: boolean };

const META_KEY = 'ballknower_cloud_meta_v1';
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

function readMeta(): Record<string, number> {
  try {
    const value = JSON.parse(localStorage.getItem(META_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function writeMeta(meta: Record<string, number>) {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch {}
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

function applyRemote(entry: StorageEntry, envelope: CloudEnvelope) {
  try {
    if (envelope?.raw === null) localStorage.removeItem(entry.localKey);
    else if (typeof envelope?.raw === 'string') localStorage.setItem(entry.localKey, envelope.raw);
  } catch (error) {
    console.warn(`Could not restore ${entry.localKey} from cloud`, error);
  }
}

export function useCloudSyncStatus() {
  return useContext(CloudSyncContext);
}

export const CloudSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<CloudSyncStatus>(isCloudConfigured ? 'connecting' : 'unconfigured');
  const [ready, setReady] = useState(!isCloudConfigured);

  useEffect(() => {
    if (!isCloudConfigured) return;
    let stopped = false;
    let localTimer = 0;
    let remoteTimer = 0;
    const meta = readMeta();
    const lastValues = new Map<string, string | null>();
    let writeChain = Promise.resolve();

    const queueUpload = (changed: StorageEntry[]) => {
      const rows = changed.flatMap(entry => {
        const value = cloudEnvelope(entry, localStorage.getItem(entry.localKey));
        return value ? [{ stateKey: entry.cloudKey, value }] : [];
      });
      if (!rows.length) return;
      writeChain = writeChain
        .then(() => saveUserStates(rows))
        .then(() => { if (!stopped) setStatus('online'); })
        .catch(error => {
          console.warn('Ball Knower cloud save failed', error);
          if (!stopped) setStatus('error');
        });
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
        writeMeta(meta);
        queueUpload(changed);
      }
    };

    const pullRemote = async (initial = false) => {
      const rows = await loadUserStates<CloudEnvelope>(CLOUD_STORAGE.map(entry => entry.cloudKey));
      const byKey = new Map(rows.map(row => [row.state_key, row]));
      const upload: StorageEntry[] = [];

      for (const entry of CLOUD_STORAGE) {
        const row = byKey.get(entry.cloudKey) as UserStateRow<CloudEnvelope> | undefined;
        const localRaw = localStorage.getItem(entry.localKey);
        const localChangedAt = meta[entry.localKey] || 0;
        const remoteChangedAt = row ? Date.parse(row.updated_at) || 0 : 0;

        if (row && remoteChangedAt >= localChangedAt) {
          applyRemote(entry, row.value);
          meta[entry.localKey] = remoteChangedAt;
        } else if (initial && localRaw !== null) {
          meta[entry.localKey] = Date.now();
          upload.push(entry);
        }
      }

      writeMeta(meta);
      for (const entry of CLOUD_STORAGE) lastValues.set(entry.localKey, localStorage.getItem(entry.localKey));
      if (upload.length) queueUpload(upload);
    };

    const startTimers = () => {
      if (!localTimer) localTimer = window.setInterval(captureLocalChanges, 800);
      if (!remoteTimer) remoteTimer = window.setInterval(() => {
        captureLocalChanges();
        void writeChain
          .then(() => pullRemote())
          .then(() => { if (!stopped) setStatus('online'); })
          .catch(error => {
            console.warn('Ball Knower cloud refresh failed', error);
            if (!stopped) setStatus('error');
          });
      }, 30_000);
    };

    void pullRemote(true)
      .then(() => {
        if (stopped) return;
        setStatus('online');
        setReady(true);
        startTimers();
      })
      .catch(error => {
        console.warn('Ball Knower cloud bootstrap failed', error);
        if (!stopped) {
          setStatus('error');
          setReady(true);
          startTimers();
        }
      });

    return () => {
      stopped = true;
      window.clearInterval(localTimer);
      window.clearInterval(remoteTimer);
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

  return <CloudSyncContext.Provider value={status}>{children}</CloudSyncContext.Provider>;
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
