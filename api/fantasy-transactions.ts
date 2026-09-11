import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;
const RPC_TIMEOUT_MS = 10_000;
const WORKERS = [
  ['scheduledDrafts', 'process_due_ball_knower_scheduled_drafts'],
  ['waivers', 'process_due_ball_knower_waivers'],
  ['drafts', 'process_due_ball_knower_draft_picks'],
  ['matchupNotifications', 'process_due_ball_knower_matchup_notifications'],
] as const;

type RpcResult = { data: any; error: any; status?: number };
type RpcRequest = PromiseLike<RpcResult> & { abortSignal: (signal: AbortSignal) => RpcRequest };
type Client = { rpc: (name: string, args: Record<string, unknown>) => RpcRequest };
type Dependencies = {
  client?: Client;
  secret?: () => string | undefined;
  serviceKey?: () => string | undefined;
  timeoutMs?: number;
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (level: 'warn' | 'error', event: Record<string, unknown>) => void;
};

// PostgREST can return an AbortError inside a plain error.message (no .name).
// Do not expose/log raw upstream text: it may contain URLs or request details.
export function classifyTransactionFailure(error: any, timedOut = false, status = 0) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  if (timedOut || error?.name === 'AbortError' || /AbortError|operation was aborted/i.test(message)) {
    return { code: 'request_timeout', retryable: true };
  }
  if (['57014', '55P03', '40001', '40P01'].includes(code)) return { code, retryable: true };
  if ([502, 503, 504].includes(status) || /gateway timeout|bad gateway|fetch failed|ECONNRESET|ETIMEDOUT/i.test(message)) {
    return { code: 'upstream_unavailable', retryable: true };
  }
  return { code: /^[A-Z0-9_]{1,24}$/.test(code) ? code : 'worker_failed', retryable: false };
}

export function createTransactionHandler(deps: Dependencies = {}) {
  const timeoutMs = deps.timeoutMs ?? RPC_TIMEOUT_MS;
  const sleep = deps.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const log = deps.log ?? ((level, event) => console[level]('fantasy-transactions worker', event));

  return async function handler(req: Request, res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    const expected = (deps.secret ?? (() => process.env.CRON_SECRET))();
    if (!expected || req.headers.authorization !== `Bearer ${expected}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.method && req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const key = (deps.serviceKey ?? (() => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY))();
    if (!deps.client && !key) return res.status(503).json({ error: 'Transaction processor is not configured.' });
    const supabase = deps.client ?? createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://gpnboygoosrmeydwjpvk.supabase.co',
      key!, { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const checkedAt = new Date().toISOString();
    const requestId = randomUUID();

    const runRpc = async (name: string) => {
      const started = Date.now();
      let failure = { code: 'worker_failed', retryable: false };
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
          // Both attempts use one durable receipt key. A lost response must not
          // re-run a committed pick, FAAB debit, roster move, or notification.
          const { data, error, status } = await supabase.rpc('run_ball_knower_transaction_job', {
            p_job: name, p_run_id: requestId, p_now: checkedAt,
          }).abortSignal(controller.signal);
          if (error) {
            failure = classifyTransactionFailure(error, controller.signal.aborted, status);
          } else if (data?.state === 'busy') {
            failure = { code: 'worker_busy', retryable: true };
          } else if (data?.state === 'completed') {
            return { ok: true as const, data: data.result, attempts: attempt, elapsedMs: Date.now() - started, replayed: data.replayed === true };
          } else {
            failure = { code: 'invalid_worker_response', retryable: false };
          }
        } catch (error) {
          failure = classifyTransactionFailure(error, controller.signal.aborted);
        } finally {
          // Keep the deadline active through response-body consumption, not
          // just until fetch returns headers (the former wrapper's gap).
          clearTimeout(timeout);
        }
        const retry = failure.retryable && attempt === 1;
        log(retry ? 'warn' : 'error', { name, requestId, attempt, code: failure.code, elapsedMs: Date.now() - started, retry });
        if (!retry) return { ok: false as const, error: failure.code, attempts: attempt, elapsedMs: Date.now() - started };
        await sleep(deps.retryDelayMs ?? (250 + Math.floor(Math.random() * 250)));
      }
      return { ok: false as const, error: failure.code, attempts: 2, elapsedMs: Date.now() - started };
    };

    const results = await Promise.all(WORKERS.map(async ([job, name]) => ({ job, result: await runRpc(name) })));
    const failures = results.filter(({ result }) => !result.ok).map(({ job, result }) => ({ job, error: result.ok ? null : result.error }));
    return res.status(failures.length ? 503 : 200).json({
      ok: failures.length === 0, checkedAt, requestId,
      ...Object.fromEntries(results.map(({ job, result }) => [job, result.ok ? result.data : null])),
      workers: Object.fromEntries(results.map(({ job, result }) => [job, { attempts: result.attempts, elapsedMs: result.elapsedMs, replayed: result.ok ? result.replayed : false }])),
      failures,
    });
  };
}

export default createTransactionHandler();
