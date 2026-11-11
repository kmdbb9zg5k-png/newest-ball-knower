import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Coins, Dumbbell, Gift, Lock, Shield, Trophy, Users, X } from 'lucide-react';
import {
  CAMPAIGN, CARD_BY_ID, CHAPTERS, FIRST_CLEAR_COINS, PACK_POSITIONS, PACK_PRICE, POSITIONS, PREMIUM_PRICE, TRAINING,
  boostPack, buyPack, chapterChoices, claimChapter, claimPack, cleared, duplicates, equip, exchangeCard, exchangeCardId,
  gameSquad, goalText, initialLegends, isLegendsResult, loadLegends, openStarter, opponentName, packFloor, playerOverall, recordClear,
  revealPack, squadOverall, trainCard, trainingCost, type LegendsResult, type LegendsState, type Position, type Scenario,
} from './bkLegends';
import './bkLegends.css';

const format = new Intl.NumberFormat('en-US');
const sections = ['Campaign', 'My Squad', 'Packs', 'Training', 'Exchange'] as const;
const groups = ['Offense', 'Defense', 'Special teams'] as const;
type Attempt = { token: string; scenario: Scenario; lineup: string[] };
const attemptKey = (token: string) => 'bk-legends-attempt:' + token;
const fieldUrl = (attempt: Attempt) => '/play-moment-3d-preview.html?' + new URLSearchParams({ bkLegends: attempt.token });

export default function BKLegends({ onBack, owner }: { onBack: () => void; owner: string }) {
  const key = 'bk-legends-v1:' + owner;
  const [save, setSave] = useState(() => {
    try { return loadLegends(localStorage, key); } catch { return initialLegends(); }
  });
  const saveRef = useRef(save);
  const [section, setSection] = useState<typeof sections[number]>('Campaign');
  const [chapter, setChapter] = useState(Math.min(7, Math.floor(save.complete / 10)));
  const [group, setGroup] = useState<typeof groups[number]>('Offense');
  const [slot, setSlot] = useState(5);
  const [position, setPosition] = useState<Position>('WR');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [outcome, setOutcome] = useState<{ result: LegendsResult; passed: boolean; persisted: boolean } | null>(null);
  const [fieldFailed, setFieldFailed] = useState(false);
  const field = useRef<HTMLIFrameElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const gotResult = useRef(false);

  function change(reducer: (state: LegendsState) => LegendsState, message?: string) {
    try {
      const latest = loadLegends(localStorage, key);
      const next = reducer(latest);
      if (next === latest) return false;
      localStorage.setItem(key, JSON.stringify(next));
      saveRef.current = next;
      setSave(next);
      if (message) setNotice(message);
      return true;
    } catch {
      setNotice('This device could not save your progress. Check that browser storage is available.');
      return false;
    }
  }
  useEffect(() => {
    function sync(event: StorageEvent) {
      if (event.key !== key) return;
      saveRef.current = loadLegends(localStorage, key);
      setSave(saveRef.current);
    }
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [key]);

  useEffect(() => {
    if (!attempt) return;
    const token = attempt.token;
    function finish(event: MessageEvent) {
      if (event.origin !== location.origin || event.source !== field.current?.contentWindow ||
          event.data?.token !== token) return;
      if (event.data.type === 'bk-legends-field-failed') { setFieldFailed(true); return; }
      if (event.data.type !== 'bk-legends-result' || gotResult.current || !isLegendsResult(event.data.result)) return;
      gotResult.current = true;
      const result: LegendsResult = event.data.result;
      const passed = cleared(attempt!.scenario, result);
      const persisted = passed && change(state => recordClear(state, attempt!.scenario, result, attempt!.lineup));
      setOutcome({ result, passed, persisted });
      if (persisted && attempt!.scenario.id >= 0) setChapter(Math.min(7, Math.floor(saveRef.current.complete / 10)));
    }
    window.addEventListener('message', finish);
    dialog.current?.showModal();
    const modal = dialog.current;
    return () => {
      window.removeEventListener('message', finish);
      modal?.close();
      try { sessionStorage.removeItem(attemptKey(token)); } catch { /* Unavailable storage is handled when launching. */ }
    };
  }, [attempt, key]);

  function launch(scenario: Scenario) {
    const state = saveRef.current;
    if (!state.starterOpened || (scenario.id >= 0 && scenario.id !== state.complete)) return;
    try {
      const token = crypto.randomUUID();
      sessionStorage.setItem(attemptKey(token), JSON.stringify({ scenario, squad: gameSquad(state) }));
      gotResult.current = false;
      setFieldFailed(false);
      setOutcome(null);
      setAttempt({ token, scenario, lineup: [...state.lineup] });
    } catch {
      setNotice('The field could not start. Check that browser storage is available.');
    }
  }
  function selectSection(next: typeof section) {
    setNotice('');
    setSection(next);
  }
  const next = CAMPAIGN[save.complete];
  const currentCard = save.lineup[slot];
  const owned = save.owned[currentCard];
  const cost = currentCard ? trainingCost(save, currentCard) : null;
  const candidateIds = Object.keys(save.owned).filter(id => CARD_BY_ID.get(id)?.position === POSITIONS[slot])
    .sort((a, b) => playerOverall(save, b) - playerOverall(save, a) || a.localeCompare(b));
  const exchangeTarget = exchangeCardId(position);
  const chapterReward = (n: number) => <div className="bkl-reward">
    <h3><Gift aria-hidden="true"/> {n === CHAPTERS.length ? 'Legacy Pack' : 'Chapter Pack'}</h3>
    <p>Choose one player for your squad.</p>
    <div className="bkl-cards">{chapterChoices(n).map(id =>
      <PlayerCard key={id} id={id} action="Claim" onAction={() => change(state => claimChapter(state, n, id), 'Player added to your collection.')}/>)}</div>
  </div>;

  return <div className="bkl" data-testid="bk-legends">
    <header className="bkl-header">
      <button type="button" onClick={onBack}><ArrowLeft aria-hidden="true"/> Back</button>
      <strong>BK Legends</strong>
      <span title="BK Legends campaign balance on this device"><Coins aria-hidden="true"/> {format.format(save.coins)} <small>BK Coins</small></span>
    </header>
    <nav className="bkl-tabs" aria-label="BK Legends sections">{sections.map(item =>
      <button key={item} type="button" aria-pressed={section === item} onClick={() => selectSection(item)}>{item}</button>)}</nav>
    {notice && <p className="bkl-notice" role="status">{notice}</p>}
    {!save.starterOpened ? <section className="bkl-hero">
      <p>BK Legends</p><h1>Road to<br/><em>Legend</em></h1>
      <span>Build a squad and take it through 80 challenges.</span>
      <button className="bkl-gold" onClick={() => change(openStarter, 'Your starting lineup is ready.')}>Open free Starter Pack <ArrowRight aria-hidden="true"/></button>
    </section> : <>
      {section === 'Campaign' && <>
        <section className="bkl-hero">
          <p>BK Legends campaign</p><h1>Road to<br/><em>Legend</em></h1>
          <span>{save.complete} / {CAMPAIGN.length} complete</span>
          <progress max={CAMPAIGN.length} value={save.complete} aria-label="Campaign progress"/>
        </section>
        {next ? <section className="bkl-panel bkl-next">
          <p className="bkl-kicker">Next challenge</p><h2>{next.title}</h2>
          <p>{goalText(next)}</p><p className="bkl-muted">{next.defending ? 'Defense' : 'Offense'} · {opponentName(next)} · {next.clock}s · {next.defending ? 'Opponent at your ' + (100 - next.ball) : (next.ball >= 50 ? 'Opponent ' + (100 - next.ball) : 'Own ' + next.ball)} yard line</p>
          <strong className="bkl-prize"><Coins aria-hidden="true"/> {format.format(FIRST_CLEAR_COINS)} BK Coins <small>First clear</small></strong>
          <button className="bkl-gold" onClick={() => launch(next)}>Play challenge <ArrowRight aria-hidden="true"/></button>
        </section> : <section className="bkl-panel"><h2><Trophy aria-hidden="true"/> Road to Legend complete</h2>{save.legacyClaimed ? <p>Legacy Pack claimed.</p> : chapterReward(CHAPTERS.length)}</section>}
        <div className="bkl-heading"><h2>Campaign Map</h2><span>{CHAPTERS.length} chapters</span></div>
        <div className="bkl-map">{CHAPTERS.map((name, n) => {
          const complete = Math.max(0, Math.min(10, save.complete - n * 10)), locked = save.complete < n * 10, expanded = chapter === n && !locked;
          return <section key={name}>
            <button className="bkl-chapter" type="button" disabled={locked} aria-expanded={expanded} aria-controls={locked ? undefined : 'bkl-chapter-' + n} onClick={() => setChapter(expanded ? -1 : n)}>
              <span className="bkl-step">{locked ? <Lock aria-label="Locked"/> : complete === 10 ? <Check aria-label="Complete"/> : String(n + 1).padStart(2, '0')}</span>
              <strong>{name}</strong><span>{complete} / 10</span>{!locked && <ChevronDown aria-hidden="true"/>}
            </button>
            <div id={'bkl-chapter-' + n} hidden={!expanded} className="bkl-chapter-body">
              {expanded && <><ol>{CAMPAIGN.slice(n * 10, n * 10 + 10).map(scenario => <li key={scenario.id}><span>{scenario.title}</span>{scenario.id < save.complete ? <Check aria-label="Complete"/> : scenario.id === save.complete ? <button onClick={() => launch(scenario)}>Play</button> : <Lock aria-label="Locked"/>}</li>)}</ol>
              {complete === 10 && (save.chapterClaims.includes(n) ? <p>Chapter Pack claimed.</p> : chapterReward(n))}</>}
            </div>
          </section>;
        })}</div>
      </>}
      {section === 'My Squad' && <section className="bkl-panel">
        <p className="bkl-kicker"><Users aria-hidden="true"/> {squadOverall(save)} team OVR</p><h1>My Squad</h1>
        <div className="bkl-tabs bkl-subtabs" aria-label="Lineup groups">{groups.map((item, n) => <button key={item} aria-pressed={item === group} onClick={() => { setGroup(item); setSlot([5, 17, 23][n]); }}>{item}</button>)}</div>
        <div className="bkl-lineup">{save.lineup.map((id, index) => {
          const side = index < 11 ? 'Offense' : index < 22 ? 'Defense' : 'Special teams';
          if (side !== group) return null;
          return <button key={index} aria-pressed={slot === index} onClick={() => setSlot(index)}><small>{POSITIONS[index]} · {playerOverall(save, id)} OVR</small><strong>{CARD_BY_ID.get(id)?.name}</strong></button>;
        })}</div>
        <h2>Manage {POSITIONS[slot]}</h2>
        {owned && <div className="bkl-upgrade">
          <strong>{CARD_BY_ID.get(currentCard)?.name} · Level {owned.level + 1}</strong>
          <span>{format.format(save.training)} Training Points</span>
          {cost === null ? <span>Max level</span> : <><span>{owned.level >= 1 && owned.clears < 3 ? `Clear 3 challenges or drills with this player starting · ${owned.clears}/3` : '+4 OVR, up to 99'}</span>
            <button className="bkl-gold" disabled={save.training < cost || (owned.level >= 1 && owned.clears < 3)} onClick={() => change(state => trainCard(state, currentCard), 'Player upgraded.')}>Upgrade · {cost} Training Points</button></>}
        </div>}
        <div className="bkl-cards">{candidateIds.map(id => <PlayerCard key={id} id={id} overall={playerOverall(save, id)} action={currentCard === id ? 'Starting' : 'Start player'} disabled={currentCard === id} onAction={() => change(state => equip(state, slot, id), 'Starting lineup updated.')}/>)}</div>
      </section>}
      {section === 'Packs' && <section className="bkl-panel">
        <p className="bkl-kicker"><Gift aria-hidden="true"/> Player collection</p><h1>Player Packs</h1>
        <p>Use the BK Coins you earn in Road to Legend. Each position pack lets you choose one of three players.</p>
        {save.pack ? <>
          <h2>{save.pack.position} {save.pack.premium ? 'Premium' : 'Standard'} Pack</h2>
          <p>{packFloor(save.pack.premium)} OVR minimum</p>
          {save.pack.choices ? <div className="bkl-cards">{save.pack.choices.map(id => <PlayerCard key={id} id={id} action="Claim" onAction={() => change(state => claimPack(state, id), 'Player added to your collection.')}/>)}</div> :
            <div className="bkl-actions">
              {!save.pack.premium && <button disabled={save.coins < PREMIUM_PRICE} onClick={() => change(boostPack, 'Premium Pack ready to open.')}>Upgrade to {packFloor(true)}+ OVR · {PREMIUM_PRICE} BK Coins</button>}
              <button className="bkl-gold" onClick={() => change(state => revealPack(state))}>Open pack</button>
            </div>}
        </> : <>
          <PositionPicker position={position} onChange={setPosition}/>
          <p>{packFloor(false)} OVR minimum · optional premium upgrade before opening</p>
          <button className="bkl-gold" disabled={save.coins < PACK_PRICE} onClick={() => change(state => buyPack(state, position), 'Pack added. Open it or upgrade it first.')}>Get {position} Pack · {format.format(PACK_PRICE)} BK Coins</button>
        </>}
      </section>}
      {section === 'Training' && <section className="bkl-panel">
        <p className="bkl-kicker"><Dumbbell aria-hidden="true"/> {format.format(save.training)} Training Points</p><h1>Training Ground</h1>
        <p>Win a drill to earn 100 Training Points. Spend them in My Squad to upgrade a starter.</p>
        <div className="bkl-drills">{TRAINING.map(drill => <div key={drill.id}><div><h2>{drill.title}</h2><p>{goalText(drill)}</p></div><button onClick={() => launch(drill)}>Play drill</button></div>)}</div>
      </section>}
      {section === 'Exchange' && <section className="bkl-panel">
        <p className="bkl-kicker"><Shield aria-hidden="true"/> {duplicates(save)} spare copies</p><h1>Player Exchange</h1>
        <p>Trade any 3 spare copies for the player shown. Your first copy of every card stays in your collection.</p>
        <PositionPicker position={position} onChange={setPosition}/>
        {exchangeTarget && <PlayerCard id={exchangeTarget} action={save.owned[exchangeTarget] ? 'Already owned' : 'Exchange 3 spare copies'} disabled={Boolean(save.owned[exchangeTarget]) || duplicates(save) < 3} onAction={() => change(state => exchangeCard(state, position), 'Exchange complete. Player added to your collection.')}/>}
      </section>}
    </>}
    <p className="bkl-save-note">BK Legends progress and campaign coins are saved on this device.</p>
    {attempt && <dialog ref={dialog} className="bkl-field" aria-label={attempt.scenario.title} onCancel={event => { event.preventDefault(); setAttempt(null); }}>
      <header><span><strong>{attempt.scenario.title}</strong><small>{goalText(attempt.scenario)}</small></span>
        <button aria-label="Leave challenge" onClick={() => setAttempt(null)}><X aria-hidden="true"/></button></header>
      {outcome ? <div className="bkl-field-result"><h2>{outcome.passed ? 'Challenge cleared' : 'Objective incomplete'}</h2>
        <p>Final score · BK Legends {outcome.result.homeScore}–{outcome.result.awayScore} {opponentName(attempt.scenario)}</p>
        <dl className="bkl-field-stats" aria-label="Challenge stats">
          <div><dt>Passing yards</dt><dd>{outcome.result.passYards}{attempt.scenario.goal === 'pass' ? ` / ${attempt.scenario.target}` : ''}</dd></div>
          <div><dt>Rushing yards</dt><dd>{outcome.result.rushYards}{attempt.scenario.goal === 'rush' ? ` / ${attempt.scenario.target}` : ''}</dd></div>
          <div><dt>{attempt.scenario.goal === 'shutout' ? 'Points allowed' : 'Plays'}</dt><dd>{attempt.scenario.goal === 'shutout' ? outcome.result.awayScore - attempt.scenario.awayScore : outcome.result.plays}</dd></div>
        </dl>
        {outcome.persisted ? <strong>{attempt.scenario.id < 0 ? '+100 Training Points' : '+1,000 BK Coins'}</strong> : outcome.passed ? <p>This attempt did not add a reward. Check your campaign progress and device storage.</p> : <p>{goalText(attempt.scenario)}</p>}
        {!outcome.passed && <button onClick={() => launch(attempt.scenario)}>Try again</button>}
        <button className="bkl-gold" onClick={() => setAttempt(null)}>Back to BK Legends</button>
      </div> : fieldFailed ? <div className="bkl-field-result"><h2>The field couldn’t load</h2><button className="bkl-gold" onClick={() => launch(attempt.scenario)}>Try again</button></div>
        : <iframe key={attempt.token} ref={field} title="BK Legends 3D football field" src={fieldUrl(attempt)} allow="fullscreen; autoplay"/>}
    </dialog>}
  </div>;
}

function PositionPicker({ position, onChange }: { position: Position; onChange: (value: Position) => void }) {
  return <label className="bkl-position">Position <select value={position} onChange={event => onChange(event.target.value as Position)}>
    {PACK_POSITIONS.map(item => <option key={item}>{item}</option>)}
  </select></label>;
}

function PlayerCard({ id, overall, action, onAction, disabled }: { id: string; overall?: number; action: string; onAction: () => void; disabled?: boolean }) {
  const card = CARD_BY_ID.get(id);
  if (!card) return null;
  return <article className="bkl-player"><span><b>{overall ?? card.overall}</b> OVR · {card.position}</span><h3>{card.name}</h3>
    <button type="button" disabled={disabled} onClick={onAction}>{action}</button></article>;
}
