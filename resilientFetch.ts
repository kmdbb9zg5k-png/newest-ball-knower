const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

type FetchPolicy = {
  fetch?: typeof fetch;
  readTimeoutMs?: number;
  writeTimeoutMs?: number;
  readAttempts?: number;
  retryDelayMs?: number;
};

/** Mutations have a deadline, but an unknown commit must never be retried here. */
export function createResilientFetch(policy: FetchPolicy = {}): typeof fetch {
  const mutations = new Map<string, Promise<Response>>();
  return async (input, init) => {
    const original = typeof Request !== 'undefined' && input instanceof Request ? input : null;
    const method = String(init?.method || original?.method || 'GET').toUpperCase();
    const canRetry = method === 'GET' || method === 'HEAD';
    const upstreamSignal = init?.signal ?? original?.signal;
    const attempts = canRetry ? policy.readAttempts ?? 3 : 1;
    const timeoutMs = canRetry ? policy.readTimeoutMs ?? 8_000 : policy.writeTimeoutMs ?? 12_000;
    const fetcher = policy.fetch ?? globalThis.fetch;
    const rawUrl = original?.url ?? String(input);
    const mutationKey = rawUrl.split(/[?#]/)[0];

    for (let attempt = 1; ; attempt++) {
      const controller = new AbortController();
      let rejectAborted: (reason: unknown) => void;
      const aborted = new Promise<never>((_resolve, reject) => { rejectAborted = reject; });
      let expired = false;
      const abort = () => {
        expired = true;
        // Keep an uncertain mutation in sequence until its transport settles.
        // Aborting it at the UI deadline could let a retry overtake its commit.
        if (canRetry || upstreamSignal?.aborted) controller.abort();
        rejectAborted(new DOMException('The request was interrupted. Try again when connected.', 'AbortError'));
      };
      if (upstreamSignal?.aborted) abort();
      else upstreamSignal?.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(abort, timeoutMs);
      try {
        if (upstreamSignal?.aborted) return await aborted;
        while (!canRetry && mutations.has(mutationKey)) {
          await Promise.race([mutations.get(mutationKey)!.catch(() => undefined), aborted]);
        }
        if (expired) return await aborted;
        // Read the body within the deadline too. A server can send headers and
        // then stall; native HTTP implementations may also ignore AbortSignal.
        const request = fetcher(input, { ...init, signal: controller.signal }).then(async response => {
          if (response.status === 204 || response.status === 205 || response.status === 304 || method === 'HEAD') return response;
          const bytes = await response.arrayBuffer();
          return new Response(bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
        });
        if (!canRetry) {
          mutations.set(mutationKey, request);
          void request.finally(() => {
            if (mutations.get(mutationKey) === request) mutations.delete(mutationKey);
          }).catch(() => undefined);
        }
        const response = await Promise.race([request, aborted]);
        if (!canRetry || !RETRYABLE_STATUS_CODES.has(response.status) || attempt >= attempts) return response;
      } catch (error) {
        if (!canRetry || upstreamSignal?.aborted || attempt >= attempts) throw error;
      } finally {
        clearTimeout(timer);
        upstreamSignal?.removeEventListener('abort', abort);
      }
      if (upstreamSignal?.aborted) throw new DOMException('The request was interrupted.', 'AbortError');
      await new Promise(resolve => setTimeout(resolve, (policy.retryDelayMs ?? 250) * attempt));
    }
  };
}

export const resilientFetch = createResilientFetch();
