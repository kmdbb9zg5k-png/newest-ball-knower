import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { fantasyWatchlistStorageKey, normalizeFantasyWatchlist } from '../fantasyWatchlist';

const source = ts.transpileModule(readFileSync(new URL('../useFantasyWatchlist.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const storage = new Map<string, string>();
const localStorage = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function host(userId: string | undefined, cloud: { loadUserState: (...args: any[]) => Promise<unknown>; saveUserState: (...args: any[]) => Promise<void> }) {
  const slots: any[] = []; let cursor = 0; let effect: (() => void | (() => void)) | undefined;
  let cleanup: void | (() => void); let rendered = false;
  const react = {
    useRef(initial: unknown) { const index = cursor++; return slots[index] ?? (slots[index] = { current: initial }); },
    useState(initial: unknown) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], (next: unknown) => { slots[index] = next; }]; },
    useEffect(callback: () => void | (() => void)) { if (!rendered) effect = callback; },
  };
  const mod = { exports: {} as any };
  runInNewContext(source, { exports: mod.exports, module: mod, localStorage, console,
    require: (name: string) => name === 'react' ? react : name === './userStateCloud' ? cloud : { fantasyWatchlistStorageKey, normalizeFantasyWatchlist } });
  const render = () => { cursor = 0; const result = mod.exports.useFantasyWatchlist(userId); rendered = true; return result; };
  return { render, mount() { render(); cleanup = effect?.(); }, unmount() { if (typeof cleanup === 'function') cleanup(); } };
}
const list = (state: any) => Array.from(state.watchlist);

storage.set('bk-fantasy-watchlist-v1', JSON.stringify(['unowned-legacy']));
storage.set(fantasyWatchlistStorageKey('account-b'), JSON.stringify(['private-b']));
const restore = deferred<unknown>();
const firstSave = deferred<void>();
const saves: any[][] = []; const reads: any[][] = [];
const a = host('account-a', {
  loadUserState: async (...args) => { reads.push(args); return restore.promise; },
  saveUserState: async (...args) => { saves.push(args); if (saves.length === 1) await firstSave.promise; },
});
a.mount();
assert.deepEqual(list(a.render()), [], 'Never adopt unowned legacy or another account cache');
a.render().toggleWatch('new-star'); await flush();
assert.equal(saves.length, 0, 'Do not overwrite cloud state before restore finishes');
restore.resolve(['existing-star']); await flush();
assert.deepEqual(list(a.render()), ['existing-star', 'new-star'], 'Replay an in-flight edit over restored stars');
assert.deepEqual(reads, [['fantasy_watchlist', 'account-a']]);
assert.equal(saves[0][2], 'account-a', 'Bind cloud writes to the captured account');
a.render().toggleWatch('existing-star'); a.render().toggleWatch('last-star'); await flush();
assert.equal(saves.length, 1, 'Do not race overlapping cloud saves');
firstSave.resolve(); await flush();
assert.equal(saves.length, 3);
assert.deepEqual(Array.from(saves[2][1]), ['new-star', 'last-star']);
a.unmount();

const late = deferred<unknown>();
const abandoned = host('account-a', { loadUserState: () => late.promise, saveUserState: async () => { throw new Error('Unexpected save'); } });
abandoned.mount(); abandoned.unmount(); late.resolve(['late-value']); await flush();
assert.deepEqual(JSON.parse(storage.get(fantasyWatchlistStorageKey('account-a'))!), ['new-star', 'last-star'], 'Unmounted restore cannot replace saved device state');
const b = host('account-b', { loadUserState: async () => null, saveUserState: async () => {} });
b.mount(); await flush(); assert.deepEqual(list(b.render()), ['private-b']); b.unmount();
let failedSaves = 0;
const failedRestore = host('account-c', { loadUserState: async () => { throw new Error('Offline'); }, saveUserState: async () => { failedSaves++; } });
failedRestore.mount(); await flush(); failedRestore.render().toggleWatch('offline-star'); await flush();
assert.equal(failedSaves, 0, 'An unavailable restore must not let a partial device list overwrite cloud state');
assert.deepEqual(JSON.parse(storage.get(fantasyWatchlistStorageKey('account-c'))!), ['offline-star']);
failedRestore.unmount();
const guest = host(undefined, { loadUserState: async () => { throw new Error('Guest must not load account state'); }, saveUserState: async () => { throw new Error('Guest must not write account state'); } });
guest.mount(); guest.render().toggleWatch('guest-star'); await flush();
assert.deepEqual(JSON.parse(storage.get(fantasyWatchlistStorageKey())!), ['guest-star']); guest.unmount();
for (const broken of [null, {}, 1, true, '[]']) assert.deepEqual(normalizeFantasyWatchlist(broken), []);
assert.deepEqual(normalizeFantasyWatchlist(['a', '', ' ', null, 8, 'a', 'b']), ['a', 'b']);
console.log('Fantasy watchlist sessions passed: account caches, explicit expected identities, restore/edit replay, serialized saves, late-response suppression and malformed values.');
