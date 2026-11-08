import { GmArtwork } from './GmArtwork';
import { GM_ALERT_SCENES, type GmScene } from './gmSceneArtwork';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { BellRing, ChevronRight, X } from 'lucide-react';
import { ModalPortal } from './ModalPortal';
import { SoloPortrait } from './solo/SoloPresentation';
import type { Player } from './types';
import { pulseGmEvent } from './gmEventHaptics';
export { pulseGmEvent } from './gmEventHaptics';
import './gmEventAlerts.css';

export type GmImportantEvent = {
  id: string;
  eyebrow: string;
  title: string;
  detail: string;
  tone?: 'trade' | 'injury' | 'relationship' | 'development';
  scene?: GmScene;
  people?: Array<{ player: Player; label: string }>;
  facts?: Array<{ label: string; value: string }>;
  choices: Array<{ id: string; label: string; detail: string; onSelect: () => void }>;
};

function readPresented(key: string): Set<string> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []);
  } catch { return new Set(); }
}

/** One interruption at a time. Closing preserves the decision and its review button. */
export function GmEventAlerts({ events, scopeKey }: { events: GmImportantEvent[]; scopeKey: string }) {
  const storageKey = `bk-gm-alerts-v1:${scopeKey}`;
  const presented = useMemo(() => readPresented(storageKey), [storageKey]);
  const [active, setActive] = useState<{ key: string; id: string } | null>(null);
  const activeRef = useRef(active);
  const [error, setError] = useState('');
  const choosing = useRef(false);
  const titleId = useId();
  const detailId = useId();
  const signature = JSON.stringify(events.map(event => event.id));
  const latestEvents = useRef(events);
  latestEvents.current = events;
  const event = active?.key === storageKey ? events.find(item => item.id === active.id) : undefined;

  useEffect(() => {
    const current = activeRef.current;
    if (current?.key === storageKey && latestEvents.current.some(item => item.id === current.id)) return;
    const next = latestEvents.current.find(item => !presented.has(item.id));
    const nextActive = next ? { key: storageKey, id: next.id } : null;
    activeRef.current = nextActive;
    choosing.current = false;
    setError('');
    setActive(nextActive);
    if (!next) return;
    presented.add(next.id);
    try { localStorage.setItem(storageKey, JSON.stringify([...presented].slice(-200))); } catch { /* Session dedup still works. */ }
    pulseGmEvent();
  }, [signature, storageKey, presented]);

  const close = () => { activeRef.current = null; setActive(null); setError(''); };
  useEffect(() => {
    if (!event) return;
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [event?.id]);

  const review = (id: string) => {
    presented.add(id);
    try { localStorage.setItem(storageKey, JSON.stringify([...presented].slice(-200))); } catch {}
    activeRef.current = { key: storageKey, id };
    choosing.current = false;
    setError('');
    setActive(activeRef.current);
  };
  const choose = (choice: GmImportantEvent['choices'][number]) => {
    if (choosing.current) return;
    choosing.current = true;
    try { choice.onSelect(); close(); }
    catch (cause) { choosing.current = false; setError(cause instanceof Error ? cause.message : 'That decision could not be saved. Please try again.'); }
  };

  return <>
    {events.length > 0 && <section className="bk-gm-alert-inbox" aria-label="GM decisions">
      <div className="bk-gm-alert-inbox-heading"><BellRing size={18} /> Front office · {events.length} pending</div>
      {events.map(item => <button type="button" key={item.id} onClick={() => review(item.id)} aria-label={`Review ${item.title}`}><span><small>{item.eyebrow}</small><strong>{item.title}</strong></span><ChevronRight size={20} /></button>)}
    </section>}
    {event && <ModalPortal><section className="bk-gm-event-screen" data-tone={event.tone} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={detailId}>
      <header><span><BellRing size={20} /> GM OFFICE</span><button type="button" onClick={close} aria-label="Close GM alert"><X size={22} /><span>Close</span></button></header>
      <div className="bk-gm-event-content"><p className="bk-gm-event-eyebrow">{event.eyebrow}</p><h1 id={titleId}>{event.title}</h1>
        <GmArtwork scene={event.scene ?? GM_ALERT_SCENES[event.tone ?? 'relationship']} />
        {event.people?.length ? <div className="bk-gm-event-people">{event.people.map(({ player, label }) => <article key={player.id}><SoloPortrait player={player} size="card" className="!h-24 !w-20 !rounded-xl"/><div><strong>{player.name}</strong><small>{label}</small></div></article>)}</div> : null}
        {event.facts?.length ? <dl className="bk-gm-event-facts">{event.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl> : null}
        <p id={detailId} className="bk-gm-event-detail">{event.detail}</p>
        <div className="bk-gm-event-rule" /><h2>Make the call</h2>
        <div className="bk-gm-event-choices">{event.choices.map(choice => <button type="button" key={choice.id} onClick={() => choose(choice)}><span><strong>{choice.label}</strong><small>{choice.detail}</small></span><ChevronRight size={22} /></button>)}</div>
        {error && <p role="alert" className="bk-gm-event-error">{error}</p>}
        <button type="button" className="bk-gm-event-later" onClick={close}>Decide later</button><p className="bk-gm-event-footnote">You can reopen this from Front office. Closing does not make a decision.</p>
      </div>
    </section></ModalPortal>}
  </>;
}
