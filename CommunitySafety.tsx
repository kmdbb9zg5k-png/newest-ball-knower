import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { useBallKnower } from './BallKnowerContext';

export type ReportableContent = 'league_message' | 'dm_message' | 'trade_message' | 'global_message' | 'community_dm' | 'profile';
const REASONS = ['harassment', 'hate', 'sexual', 'threats', 'spam', 'impersonation', 'rights', 'other'] as const;
const CHANGE_EVENT = 'ball-knower-community-safety-changed';

// Account-bound requests: never let a slow response or a session refresh apply
// one account's moderation choices to the next account on the same device.
async function safetyRequest(expectedUserId: string, operation: string, args: Record<string, unknown>) {
  if (!supabase) throw new Error('Safety controls require an online connection.');
  const { data: session } = await supabase.auth.getSession();
  if (session.session?.user.id !== expectedUserId) throw new Error('Your account changed. Reopen this screen.');
  const { data, error } = await supabase.rpc(operation, { ...args, p_expected_user_id: expectedUserId }).abortSignal(AbortSignal.timeout(8000));
  if (error) throw new Error(error.message || 'The safety request could not be saved.');
  return data;
}

export function useCommunitySafety() {
  const { currentUser } = useBallKnower();
  const userId = currentUser?.id || '';
  const [snapshot, setSnapshot] = useState<{ userId: string; ids: string[] }>({ userId: '', ids: [] });
  const [error, setError] = useState('');
  const generation = useRef(0);
  const identityRef = useRef(userId);
  identityRef.current = userId;
  const reload = useCallback(async () => {
    const version = ++generation.current;
    if (!supabase || !userId) { setSnapshot({ userId, ids: [] }); return; }
    try {
      const { data, error: queryError } = await supabase.from('ball_knower_user_blocks')
        .select('blocked_id').eq('blocker_id', userId).abortSignal(AbortSignal.timeout(8000));
      if (queryError) throw queryError;
      if (version !== generation.current) return;
      setSnapshot({ userId, ids: (data || []).map(row => String(row.blocked_id)) });
      setError('');
    } catch { if (version === generation.current) setError('Safety controls could not refresh. Retry or contact support.'); }
  }, [userId]);
  useEffect(() => {
    setSnapshot({ userId, ids: [] });
    void reload();
    const refresh = () => void reload();
    window.addEventListener(CHANGE_EVENT, refresh);
    return () => { generation.current += 1; window.removeEventListener(CHANGE_EVENT, refresh); };
  }, [reload, userId]);
  const blockedIds = snapshot.userId === userId ? snapshot.ids : [];
  const setBlocked = async (otherId: string, blocked: boolean) => {
    const expected = userId;
    await safetyRequest(expected, 'set_ball_knower_community_block', { p_user_id: otherId, p_blocked: blocked });
    if (identityRef.current !== expected) return;
    generation.current += 1;
    setSnapshot(previous => ({ userId: expected, ids: blocked
      ? [...new Set([...(previous.userId === expected ? previous.ids : []), otherId])]
      : previous.ids.filter(id => id !== otherId) }));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return { blockedIds, isBlocked: (id?: string) => Boolean(id && blockedIds.includes(id)), setBlocked, reload, error };
}
export type CommunitySafetyState = ReturnType<typeof useCommunitySafety>;

export function MessageSafety({ contentType, contentId, authorId, safety }: {
  contentType: ReportableContent; contentId: string; authorId?: string; safety: CommunitySafetyState;
}) {
  const { currentUser } = useBallKnower();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<typeof REASONS[number]>('harassment');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const scope = `${currentUser?.id}:${contentType}:${contentId}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  useEffect(() => { setOpen(false); setStatus(''); setDetails(''); setBusy(false); }, [scope]);
  if (!currentUser || !authorId || authorId === currentUser.id) return null;
  const submit = async (work: () => Promise<unknown>, success: string) => {
    if (busy) return;
    const expectedScope = scope;
    setBusy(true); setStatus('');
    try { await work(); if (scopeRef.current === expectedScope) setStatus(success); }
    catch (error) { if (scopeRef.current === expectedScope) setStatus(error instanceof Error ? error.message : 'Unable to save. Contact support.'); }
    finally { if (scopeRef.current === expectedScope) setBusy(false); }
  };
  const reportOperation = contentType === 'global_message' || contentType === 'community_dm'
    ? 'report_ball_knower_community_content'
    : 'report_ball_knower_content';
  return <div className="mt-1 text-[10px] leading-5 text-zinc-400">
    <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)} className="min-h-11 px-2 underline">Report / Block</button>
    {open && <div className="space-y-2 rounded-xl border border-white/15 bg-[#101318] p-3 text-zinc-200">
      <p>Reports go to Ball Knower support. Blocking hides this manager's posts and stops direct, trade and friend interactions. It does not remove either manager's team.</p>
      <label className="block">Reason<select aria-label="Report reason" value={reason} onChange={event => setReason(event.target.value as typeof reason)} className="ml-2 min-h-11 rounded bg-[#20242d] px-2">{REASONS.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="block">Additional information<textarea aria-label="Report details" maxLength={1000} value={details} onChange={event => setDetails(event.target.value)} className="mt-1 min-h-20 w-full rounded-lg bg-[#20242d] p-2"/></label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void submit(() => safetyRequest(currentUser.id, reportOperation, { p_content_type: contentType, p_content_id: contentId, p_reason: reason, p_details: details }), 'Report saved for support review.')} className="min-h-11 rounded-lg border border-white/20 px-3 disabled:opacity-40">Report content</button>
        {contentType !== 'profile' && <button type="button" disabled={busy} onClick={() => void submit(() => safetyRequest(currentUser.id, reportOperation, { p_content_type: 'profile', p_content_id: authorId, p_reason: reason, p_details: details }), 'Profile report saved for support review.')} className="min-h-11 rounded-lg border border-white/20 px-3 disabled:opacity-40">Report profile/photo</button>}
        <button type="button" disabled={busy} onClick={() => void submit(() => safety.setBlocked(authorId, !safety.isBlocked(authorId)), safety.isBlocked(authorId) ? 'Manager unblocked.' : 'Manager blocked.')} className="min-h-11 rounded-lg border border-red-300/30 px-3 text-red-200 disabled:opacity-40">{safety.isBlocked(authorId) ? 'Unblock manager' : 'Block manager'}</button>
      </div>
    </div>}
    {status && <p role="status" className="rounded bg-[#101318] p-2 text-zinc-200">{status}</p>}
  </div>;
}

export function CommunitySafetySettings({ safety, names }: { safety: CommunitySafetyState; names: Record<string, string> }) {
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState('');
  const [selectedManager, setSelectedManager] = useState('');
  const { currentUser } = useBallKnower();
  const scopeRef = useRef(currentUser?.id);
  scopeRef.current = currentUser?.id;
  useEffect(() => { setStatus(''); setPending(''); setSelectedManager(''); }, [currentUser?.id]);
  const unblock = async (id: string) => {
    if (pending) return;
    const expected = currentUser?.id;
    setPending(id); setStatus('');
    try { await safety.setBlocked(id, false); if (scopeRef.current === expected) setStatus('Manager unblocked.'); }
    catch (error) { if (scopeRef.current === expected) setStatus(error instanceof Error ? error.message : 'Could not unblock.'); }
    finally { if (scopeRef.current === expected) setPending(''); }
  };
  return <details className="my-2 rounded-xl border border-white/10 p-3 text-xs text-zinc-300">
    <summary className="flex min-h-11 cursor-pointer items-center">Community safety · Blocked managers ({safety.blockedIds.length})</summary>
    <p>Keep football discussion respectful. No harassment, threats, hateful or sexual abuse, spam, impersonation, or unauthorized content.</p>
    <label className="mt-2 block">Report or block a manager<select aria-label="Manager safety controls" className="ml-2 min-h-11 max-w-full rounded bg-[#20242d] px-2" value={selectedManager} onChange={event => setSelectedManager(event.target.value)}><option value="">Choose manager…</option>{Object.entries(names).filter(([id]) => id !== currentUser?.id && /^[0-9a-f-]{36}$/i.test(id)).map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
    {selectedManager && names[selectedManager] && <MessageSafety contentType="profile" contentId={selectedManager} authorId={selectedManager} safety={safety}/>}
    {safety.error && <p role="alert">{safety.error} <button type="button" className="min-h-11 px-2 underline" onClick={() => void safety.reload()}>Retry</button></p>}
    {safety.blockedIds.map(id => <div key={id} className="flex items-center justify-between gap-2"><span>{names[id] || 'Blocked manager'}</span><button type="button" disabled={Boolean(pending)} className="min-h-11 px-3 underline" onClick={() => void unblock(id)}>Unblock</button></div>)}
    {status && <p role="status">{status}</p>}
    <a className="inline-flex min-h-11 items-center underline" href="mailto:BallKnowerOfficial@gmail.com?subject=Community%20safety%20report">Contact Ball Knower support</a>
  </details>;
}
