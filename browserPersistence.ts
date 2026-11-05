/** Optional browser caching must never abort navigation or a React state update. */
export function persistBrowserValue(
  key: string,
  value: string | null,
  getStorage: () => Pick<Storage, 'setItem' | 'removeItem'> = () => window.localStorage,
): boolean {
  try {
    const storage = getStorage();
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
    return true;
  } catch {
    // Quota exhaustion and blocked storage both leave the in-memory session usable.
    return false;
  }
}
