import { isIP } from 'node:net';

/** Configured providers must be public HTTPS hosts. Never accept URLs from a request. */
export function publicHttpsUrl(input: unknown): string {
  if (typeof input !== 'string') return '';
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !host.includes('.') || isIP(host) || host.startsWith('[') ||
        /(^|\.)(localhost|local|internal|home|lan)$/.test(host)) return '';
    url.hash = '';
    return url.href;
  } catch { return ''; }
}

type FetchOptions = {
  maxBytes: number;
  timeoutMs: number;
  accept?: string;
  allowedRedirectHosts?: readonly string[];
  fetchImpl?: typeof fetch;
};

/** Bounds decompressed bytes while streaming, and one deadline across redirects + body. */
export async function fetchBoundedText(url: string, options: FetchOptions) {
  let target = publicHttpsUrl(url);
  if (!target) throw new Error('invalid_feed_config');
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('source_timeout'));
    }, options.timeoutMs);
  });
  const bounded = <T>(promise: Promise<T>) => Promise.race([promise, deadline]);
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const response = await bounded((options.fetchImpl ?? fetch)(target, {
        headers: { Accept: options.accept ?? 'application/json' },
        signal: controller.signal,
        redirect: 'manual',
      }));
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        void response.body?.cancel().catch(() => {});
        const location = response.headers.get('location');
        const next = location && publicHttpsUrl(new URL(location, target).href);
        if (!next || !options.allowedRedirectHosts?.includes(new URL(next).hostname) || redirects === 3) {
          throw new Error('unsafe_source_redirect');
        }
        target = next;
        continue;
      }
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        throw new Error('source_unavailable');
      }
      const length = Number(response.headers.get('content-length'));
      if (Number.isFinite(length) && length > options.maxBytes) {
        void response.body?.cancel().catch(() => {});
        throw new Error('response_too_large');
      }
      if (!response.body) throw new Error('empty_source');
      reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const chunk = await bounded(reader.read());
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > options.maxBytes) throw new Error('response_too_large');
        chunks.push(chunk.value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const modified = response.headers.get('last-modified');
      const sourceTime = modified ? Date.parse(modified) : NaN;
      return {
        text: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
        sourceUpdatedAt: Number.isFinite(sourceTime) && sourceTime <= Date.now() + 60_000
          ? new Date(sourceTime).toISOString() : null,
      };
    }
    throw new Error('unsafe_source_redirect');
  } finally {
    clearTimeout(timer!);
    controller.abort();
    if (reader) void reader.cancel().catch(() => {});
  }
}
