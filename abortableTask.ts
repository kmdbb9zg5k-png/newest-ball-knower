/** Stop waiting for work that cannot itself receive an AbortSignal (for example auth). */
export function abortableTask<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const aborted = () => reject(new DOMException('The request was stopped.', 'AbortError'));
    // Always observe work, including a rejection arriving after cancellation.
    work.then(value => { signal.removeEventListener('abort', aborted); if (!signal.aborted) resolve(value); }, error => {
      signal.removeEventListener('abort', aborted);
      if (!signal.aborted) reject(error);
    });
    if (signal.aborted) aborted();
    else signal.addEventListener('abort', aborted, { once: true });
  });
}
