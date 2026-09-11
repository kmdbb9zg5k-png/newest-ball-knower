import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { classifyTransactionFailure, createTransactionHandler } from '../api/fantasy-transactions';

const invoke = async (handler: ReturnType<typeof createTransactionHandler>, authorization = 'Bearer test-cron', method = 'GET') => {
  const output = { status: 0, body: null as any, headers: {} as Record<string, string> };
  const res: any = { setHeader: (name: string, value: string) => { output.headers[name] = value; }, status: (status: number) => { output.status = status; return res; }, json: (body: any) => { output.body = body; return res; } };
  await handler({ method, headers: { authorization } } as any, res);
  return output;
};
const records: Array<{ name: string; args: any; signal: AbortSignal }> = [];
const clientFor = (fn: (args: any, signal: AbortSignal) => Promise<any>) => ({
  rpc(name: string, args: any) {
    return { abortSignal(signal: AbortSignal) {
      records.push({ name, args, signal });
      return { then: (ok: any, fail: any) => fn(args, signal).then(ok, fail) };
    } };
  },
}) as any;
const logs: any[] = [];
const options = { secret: () => 'test-cron', timeoutMs: 20, retryDelayMs: 0, sleep: async () => {}, log: (_level: 'warn' | 'error', event: any) => { logs.push(event); } };
const successful = () => ({ data: { state: 'completed', result: { processed: 1 }, replayed: false }, error: null });

let called = 0;
const successHandler = createTransactionHandler({ ...options, client: clientFor(async () => { called++; return successful(); }) });
assert.equal((await invoke(successHandler, 'Bearer wrong')).status, 401);
assert.equal(called, 0, 'unauthorized requests must never run a worker');
assert.equal((await invoke(successHandler, 'Bearer test-cron', 'POST')).status, 405);
assert.equal(called, 0, 'unsupported methods must never mutate data');
assert.equal((await invoke(createTransactionHandler({ ...options, serviceKey: () => '' }))).status, 503);
const good = await invoke(successHandler);
assert.equal(good.status, 200);
assert.equal(called, 4);
assert.deepEqual(good.body.failures, []);
assert.equal(good.headers['Cache-Control'], 'no-store');
assert.ok(['scheduledDrafts', 'waivers', 'drafts', 'matchupNotifications'].every(key => good.body[key]?.processed === 1));
assert.ok(records.every(row => row.name === 'run_ball_knower_transaction_job'), 'mutating workers must only execute through the durable receipt wrapper');
assert.equal(new Set(records.map(row => row.args.p_now)).size, 1, 'all workers share the same processing instant');
assert.equal(new Set(records.map(row => row.args.p_run_id)).size, 1, 'each request shares a UUID scoped by worker name');

// Model a committed transaction whose response was lost. The same receipt must
// be replayed on retry, never an additional mutation or FAAB debit.
const receipts = new Map<string, any>();
const mutations = new Map<string, number>();
let lostResponse = false;
records.length = 0;
const recovered = await invoke(createTransactionHandler({ ...options, client: clientFor(async args => {
  const key = `${args.p_job}:${args.p_run_id}`;
  if (receipts.has(key)) return { data: { state: 'completed', replayed: true, result: receipts.get(key) }, error: null };
  mutations.set(args.p_job, (mutations.get(args.p_job) || 0) + 1);
  receipts.set(key, { processed: 1 });
  if (args.p_job.endsWith('waivers') && !lostResponse) { lostResponse = true; return { data: null, error: { message: 'AbortError: This operation was aborted' } }; }
  return successful();
}) }));
assert.equal(recovered.status, 200);
assert.equal(recovered.body.workers.waivers.attempts, 2);
assert.equal(recovered.body.workers.waivers.replayed, true);
assert.ok([...mutations.values()].every(count => count === 1), 'lost-response recovery must not repeat any completed mutation');
const waiverAttempts = records.filter(row => row.args.p_job.endsWith('waivers'));
assert.deepEqual(waiverAttempts[0].args, waiverAttempts[1].args, 'a retry must preserve its receipt key AND processing instant');

let busy = true;
const overlap = await invoke(createTransactionHandler({ ...options, client: clientFor(async args => {
  if (args.p_job.endsWith('draft_picks') && busy) { busy = false; return { data: { state: 'busy' }, error: null }; }
  return successful();
}) }));
assert.equal(overlap.status, 200);
assert.equal(overlap.body.workers.drafts.attempts, 2);

records.length = 0;
const failed = await invoke(createTransactionHandler({ ...options, client: clientFor(async args => args.p_job.endsWith('waivers') ? { data: null, error: { code: '42501', message: 'permission denied https://private.example/key=SECRET' } } : successful()) }));
assert.equal(failed.status, 503, 'a real failure must not be hidden by successful sibling workers');
assert.equal(failed.body.waivers, null);
assert.equal(failed.body.failures[0].job, 'waivers');
assert.equal(failed.body.workers.waivers.attempts, 1, 'permanent errors must not retry');
assert.ok(!JSON.stringify(logs).includes('SECRET'), 'logs must not contain untrusted upstream text or secrets');

// Exercise the actual Supabase response parser: headers arrive immediately but
// the body stalls. Abort must remain armed until response.text() finishes.
let bodyAborted = false;
const attempts = new Map<string, number>();
const bodyClient = createClient('https://example.test', 'test-key', {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (async (_input: any, init: any) => {
    const args = JSON.parse(init.body);
    const count = (attempts.get(args.p_job) || 0) + 1;
    attempts.set(args.p_job, count);
    if (args.p_job.endsWith('waivers') && count === 1) {
      return new Response(new ReadableStream({ start(controller) {
        init.signal.addEventListener('abort', () => { bodyAborted = true; controller.error(new DOMException('Aborted during body read', 'AbortError')); }, { once: true });
      } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ state: 'completed', result: { processed: 0 }, replayed: count > 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch },
});
const parsed = await invoke(createTransactionHandler({ ...options, client: bodyClient as any }));
assert.equal(parsed.status, 200);
assert.equal(bodyAborted, true, 'the timeout must cover the body, not just the response headers');
assert.equal(parsed.body.workers.waivers.attempts, 2);

const exhausted = await invoke(createTransactionHandler({ ...options, client: clientFor(async (_args, signal) => new Promise((_resolve, reject) => {
  signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
})) }));
assert.equal(exhausted.status, 503);
assert.equal(exhausted.body.failures.length, 4);
assert.ok(Object.values(exhausted.body.workers).every((worker: any) => worker.attempts === 2));
assert.ok(logs.some(row => row.retry === true && row.code === 'request_timeout'));
assert.ok(logs.some(row => row.retry === false && row.code === 'request_timeout'));
assert.equal(classifyTransactionFailure({ code: '57014' }).retryable, true);
assert.equal(classifyTransactionFailure({ code: '23514' }).retryable, false);
assert.equal(classifyTransactionFailure({ message: 'Gateway Timeout' }).retryable, true);
assert.equal(classifyTransactionFailure({}, false, 504).retryable, true);
assert.equal(classifyTransactionFailure({ code: 'PGRST202' }).retryable, false, 'a missing migration must fail visibly, not retry blindly');
console.log('Transaction worker checks passed: auth, method/config guards, four-worker isolation, durable replay keys, bounded retries, permanent errors, overlap recovery, response-body deadlines, and redacted diagnostics.');
