import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Coins, Dumbbell, Gift, Lock, Shield, Trophy, X } from 'lucide-react';
import {
  CAMPAIGN, CARD_BY_ID, CHAPTERS, FIRST_CLEAR_COINS, GHOST_SCENARIO, GHOST_TRAIT_BONUS, GHOST_TRAIT_WINS, GHOST_TRAIT_YARDS,
  PACK_POSITIONS, PACK_TIERS, PACK_TIER_IDS, POSITIONS, PREMIUM_PRICE, TRAINING,
  boostPack, buyPack, chapterChoices, claimChapter, claimPack, cleared, duplicates, equip, exchangeCard, exchangeCardId, ghostTraitWins,
  gameSquad, goalText, initialLegends, isLegendsResult, loadLegends, openStarter, opponentName, packOptionCount, packTier, playerOverall, recordClear,
  revealPack, squadOverall, trainCard, trainingCost, type LegendsResult, type LegendsState, type PackTier, type Position, type Scenario,
} from './bkLegends';
import './bkLegends.css';

const format = new Intl.NumberFormat('en-US');
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const driveTime = (ms: number) => (ms / 1000).toFixed(3) + 's';
const sections = ['Campaign', 'My Squad', 'Packs', 'Training', 'Exchange'] as const;
const groups = ['Offense', 'Defense', 'Special teams'] as const;
const starterPreview = openStarter(initialLegends());
const formation = {
  Offense: [[0, 1, 2, 3, 4], [7, 8, 9, 10], [5, 6, 22]],
  Defense: [[11, 12, 13, 14], [15, 16, 17], [18, 19, 20, 21]],
  'Special teams': [[23, 24]],
};
const depthLabels = POSITIONS.map((position, index) => POSITIONS.filter(value => value === position).length > 1
  ? position + (POSITIONS.slice(0, index).filter(value => value === position).length + 1)
  : position);
const portraitOrder = formation.Offense.flat();
function DepthPortrait({ id }: { id: string }) {
  const starterIndex = starterPreview.lineup.indexOf(id);
  const offenseIndex = portraitOrder.indexOf(starterIndex);
  const frame = offenseIndex >= 0 ? offenseIndex : starterIndex >= 0 ? starterIndex % 12
    : Array.from(id).reduce((hash, letter) => (hash * 31 + letter.charCodeAt(0)) % 12, 0);
  return <span className="bkl-depth-portrait" aria-hidden="true" style={{
    backgroundPosition: (frame % 4 * 100 / 3) + '% ' + (Math.floor(frame / 4) * 50) + '%',
  }}/>;
}
type Attempt = { token: string; scenario: Scenario; lineup: string[]; ghostTargetMs?: number };
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
  const [selectedTier, setSelectedTier] = useState<PackTier>('good');
  const [payment, setPayment] = useState<'coins' | 'usd'>('coins');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [outcome, setOutcome] = useState<{
    result: LegendsResult; passed: boolean; persisted: boolean; newBest?: boolean; receiverProgress?: { id: string; wins: number }[];
  } | null>(null);
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
      const ghost = attempt!.scenario.id === GHOST_SCENARIO.id;
      let newBest = false;
      let receiverProgress: { id: string; wins: number }[] = [];
      const persisted = passed && change(state => {
        const next = recordClear(state, attempt!.scenario, result, attempt!.lineup);
        if (ghost) {
          newBest = next.ghostBest !== state.ghostBest;
          receiverProgress = attempt!.lineup.slice(7, 10).map(id => ({ id, wins: ghostTraitWins(next, id) }))
            .filter(({ id, wins }) => wins > ghostTraitWins(state, id));
        }
        return next;
      });
      setOutcome({ result, passed, persisted, newBest: persisted && newBest, receiverProgress: persisted ? receiverProgress : [] });
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
      sessionStorage.setItem(attemptKey(token), JSON.stringify({ scenario, squad: gameSquad(state), ghost: scenario.id === GHOST_SCENARIO.id }));
      gotResult.current = false;
      setFieldFailed(false);
      setOutcome(null);
      setAttempt({ token, scenario, lineup: [...state.lineup], ghostTargetMs: state.ghostBest?.elapsedMs });
    } catch {
      setNotice('The field could not start. Check that browser storage is available.');
    }
  }
  function selectSection(next: typeof section) {
    setNotice('');
    setSection(next);
  }
  const next = CAMPAIGN[save.complete];
  const unclaimedChapters = CHAPTERS.map((_, n) => n)
    .filter(n => save.complete >= (n + 1) * 10 && !save.chapterClaims.includes(n));
  const depthChart = save.starterOpened ? save : starterPreview;
  const selectedStarter = CARD_BY_ID.get(depthChart.lineup[slot])!;
  const currentCard = save.lineup[slot];
  const owned = save.owned[currentCard];
  const receiverWins = ghostTraitWins(save, currentCard);
  const ghostAttempt = attempt?.scenario.id === GHOST_SCENARIO.id;
  const cost = currentCard ? trainingCost(save, currentCard) : null;
  const candidateIds = Object.keys(save.owned).filter(id => CARD_BY_ID.get(id)?.position === POSITIONS[slot])
    .sort((a, b) => playerOverall(save, b) - playerOverall(save, a) || a.localeCompare(b));
  const exchangeTarget = exchangeCardId(position);
  const offer = PACK_TIERS[selectedTier];
  const available = packOptionCount(position, selectedTier) >= 3;
  const pendingTier = save.pack ? packTier(save.pack) : null;
  const priceLabel = (tier: PackTier) => payment === 'coins'
    ? format.format(PACK_TIERS[tier].coins) + ' BK Coins'
    : usd.format(PACK_TIERS[tier].usdCents / 100);
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
    {!save.starterOpened && section !== 'My Squad' ? <section className="bkl-hero bkl-campaign-art">
      <p>BK Legends</p><h1>Road to<br/><em>Legend</em></h1>
      <span>Build a squad and take it through 80 challenges.</span>
      <button className="bkl-gold" onClick={() => change(openStarter, 'Your starting lineup is ready.')}>Open free Starter Pack <ArrowRight aria-hidden="true"/></button>
    </section> : <>
      {section === 'Campaign' && <>
        <section className="bkl-hero bkl-campaign-art">
          <p>BK Legends campaign</p><h1>Road to<br/><em>Legend</em></h1>
          <span>{save.complete} / {CAMPAIGN.length} complete</span>
          <progress max={CAMPAIGN.length} value={save.complete} aria-label="Campaign progress"/>
        </section>
        {next ? <section className="bkl-panel bkl-next">
          <p className="bkl-kicker">Next challenge</p><h2>{next.title}</h2>
          <p>{goalText(next)}</p><p className="bkl-muted">{next.defending ? 'Defense' : 'Offense'} · {opponentName(next)} · {next.clock}s · {next.defending ? 'Opponent at your ' + (100 - next.ball) : (next.ball >= 50 ? 'Opponent ' + (100 - next.ball) : 'Own ' + next.ball)} yard line</p>
          <dl className="bkl-starting-situation" aria-label="Starting situation">
            <div><dt>Starting score</dt><dd>BK Legends {next.score}–{next.awayScore}</dd></div>
            <div><dt>Your timeouts</dt><dd>{next.timeouts}</dd></div>
          </dl>
          <strong className="bkl-prize"><Coins aria-hidden="true"/> {format.format(FIRST_CLEAR_COINS)} BK Coins <small>First clear</small></strong>
          <button className="bkl-gold" onClick={() => launch(next)}>Play challenge <ArrowRight aria-hidden="true"/></button>
        </section> : <section className="bkl-panel"><h2><Trophy aria-hidden="true"/> Road to Legend complete</h2>{save.legacyClaimed ? <p>Legacy Pack claimed.</p> : chapterReward(CHAPTERS.length)}</section>}
        <section className="bkl-panel bkl-ghost" aria-labelledby="bkl-ghost-heading">
          <h2 id="bkl-ghost-heading">Ghost Drive</h2>
          <p>Down 21–17 with 55 seconds left. Start at the opponent’s 25 and score on one drive.</p>
          {save.ghostBest && <GhostDriveSummary drive={save.ghostBest}/>}
          <button className="bkl-gold" type="button" onClick={() => launch(GHOST_SCENARIO)}>
            {save.ghostBest ? 'Beat your best' : 'Play The Winning Drive'} <ArrowRight aria-hidden="true"/>
          </button>
          <p>Earn Clutch Receiver with {GHOST_TRAIT_YARDS}+ receiving yards in {GHOST_TRAIT_WINS} Ghost Drive wins with the same receiver.</p>
        </section>
        {unclaimedChapters.length > 0 && <section className="bkl-panel bkl-chapter-rewards" aria-labelledby="bkl-chapter-rewards">
          <h2 id="bkl-chapter-rewards">Unclaimed chapter packs</h2>
          {unclaimedChapters.map(n => <details key={n}>
            <summary>{CHAPTERS[n]} Pack</summary>
            {chapterReward(n)}
          </details>)}
        </section>}
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
              {complete === 10 && <p>{save.chapterClaims.includes(n) ? 'Chapter Pack claimed.' : 'Chapter Pack ready to claim.'}</p>}</>}
            </div>
          </section>;
        })}</div>
      </>}
      {section === 'My Squad' && <section className="bkl-squad-board">
        <header className="bkl-depth-banner">
          <h1>Depth Chart</h1>
          <p><strong>{squadOverall(depthChart)}</strong> Team OVR</p>
        </header>
        <div className="bkl-tabs bkl-depth-tabs" aria-label="Lineup groups">{groups.map((item, n) => <button key={item} aria-pressed={item === group} onClick={() => { setGroup(item); setSlot([5, 17, 23][n]); }}>{item}</button>)}</div>
        <ul className="bkl-depth-field" aria-label={group + ' starters'}>{formation[group].map((row, rowIndex) =>
          <li key={rowIndex} className="bkl-depth-row">
            {row.map(index => {
              const id = depthChart.lineup[index];
              const card = CARD_BY_ID.get(id)!;
              const overall = playerOverall(depthChart, id);
              return <button type="button" key={index} aria-pressed={slot === index}
                aria-label={depthLabels[index] + ' ' + card.name + ', ' + overall + ' overall'} onClick={() => setSlot(index)}>
                <DepthPortrait id={id}/>
                <span className="bkl-depth-name">{card.name[0]}. {card.lastName}</span>
                <span className="bkl-depth-rating"><b>{depthLabels[index]}</b><strong>{overall}</strong></span>
              </button>;
            })}
          </li>
        )}</ul>
        <div className="bkl-depth-selected">
          <DepthPortrait id={selectedStarter.id}/>
          <div><h2>{depthLabels[slot]} · {selectedStarter.name}</h2><p>{save.starterOpened ? 'Starter' : 'Projected starter'} · #{selectedStarter.number}</p></div>
          <strong>{playerOverall(depthChart, selectedStarter.id)} <small>OVR</small></strong>
        </div>
        {owned && selectedStarter.position === 'WR' && <p className="bkl-ghost-trait">
          <strong>Clutch Receiver</strong> · {receiverWins === GHOST_TRAIT_WINS
            ? `+${GHOST_TRAIT_BONUS} catching in BK Legends, up to 97`
            : `${receiverWins}/${GHOST_TRAIT_WINS} qualifying Ghost Drive wins`}
        </p>}
        {!save.starterOpened && <button className="bkl-gold" onClick={() => change(openStarter, 'Your starting lineup is ready.')}>Open free Starter Pack <ArrowRight aria-hidden="true"/></button>}
        {owned && <div className="bkl-upgrade">
          <strong>{CARD_BY_ID.get(currentCard)?.name} · Level {owned.level + 1}</strong>
          <span>{format.format(save.training)} Training Points</span>
          {cost === null ? <span>Max level</span> : <><span>{owned.level >= 1 && owned.clears < 3 ? `Clear 3 challenges or drills with this player starting · ${owned.clears}/3` : '+4 OVR, up to 99'}</span>
            <button className="bkl-gold" disabled={save.training < cost || (owned.level >= 1 && owned.clears < 3)} onClick={() => change(state => trainCard(state, currentCard), 'Player upgraded.')}>Upgrade · {cost} Training Points</button></>}
        </div>}
        {save.starterOpened && <section className="bkl-depth-reserves" aria-label={depthLabels[slot] + ' depth'}>
          <h3>Available depth</h3>
          {candidateIds.length === 1 ? <p>No other players at this position yet.</p> : candidateIds.filter(id => id !== currentCard).map(id => {
            const card = CARD_BY_ID.get(id)!;
            const startingSlot = save.lineup.indexOf(id);
            return <div key={id} className="bkl-depth-reserve">
              <DepthPortrait id={id}/>
              <div><strong>{card.name}</strong><p>{startingSlot >= 0 ? 'Starting at ' + depthLabels[startingSlot] : 'Backup'} · {playerOverall(save, id)} OVR</p></div>
              <button type="button" onClick={() => change(state => equip(state, slot, id), 'Starting lineup updated.')}>Start</button>
            </div>;
          })}
        </section>}
      </section>}
      {section === 'Packs' && <section className="bkl-panel bkl-pack-showcase">
        <header className="bkl-pack-heading">
          <p className="bkl-kicker"><Gift aria-hidden="true"/> BK Legends</p>
          <h1>{pendingTier ? 'Player Packs' : 'Choose Your Pack'}</h1>
          <p>{save.pack?.position ?? position} only · Pick 1 of 3 players</p>
        </header>
        {!save.pack && <>
          <div className="bkl-tabs bkl-pack-positions" aria-label="Pack positions">
            {PACK_POSITIONS.map(item => <button key={item} type="button" aria-pressed={position === item} onClick={() => setPosition(item)}>{item}</button>)}
          </div>
          <div className="bkl-pack-payment" role="group" aria-label="Payment method">
            <button type="button" aria-pressed={payment === 'coins'} onClick={() => setPayment('coins')}>BK Coins</button>
            <button type="button" aria-pressed={payment === 'usd'} onClick={() => setPayment('usd')}>USD</button>
          </div>
          <div className="bkl-pack-options" role="group" aria-label="Pack tiers">
            {PACK_TIER_IDS.map(tier => <button key={tier} type="button" aria-pressed={selectedTier === tier} onClick={() => setSelectedTier(tier)}>
              <img src={'/images/bk-legends-pack-' + tier + '.webp'} alt="" width={240} height={400}/>
              <strong>{PACK_TIERS[tier].label}</strong>
              <span>{PACK_TIERS[tier].floor}+ OVR</span>
              <span className="bkl-pack-cost">{priceLabel(tier)}</span>
              {packOptionCount(position, tier) < 3 && <small>Unavailable at {position}</small>}
            </button>)}
          </div>
          <dl className="bkl-pack-summary">
            {payment === 'coins' && <div><dt>Your balance</dt><dd>{format.format(save.coins)} BK Coins</dd></div>}
            <div><dt>{offer.label} {position} Pack</dt><dd>{priceLabel(selectedTier)}</dd></div>
            {payment === 'coins' && available && save.coins >= offer.coins && <div><dt>Balance after purchase</dt><dd>{format.format(save.coins - offer.coins)} BK Coins</dd></div>}
          </dl>
          {!available && <p className="bkl-pack-note">Choose a different position or tier. This pack needs three eligible players.</p>}
          {payment === 'usd' ? <>
            <button type="button" className="bkl-gold" disabled>Continue to payment</button>
            <p className="bkl-pack-note">USD checkout is unavailable. Switch to BK Coins to buy a pack.</p>
          </> : <>
            <button type="button" className="bkl-gold" disabled={!available || save.coins < offer.coins}
              onClick={() => change(state => buyPack(state, position, selectedTier), 'Pack added. Open it when you’re ready.')}>Buy {offer.label} {position} Pack <ArrowRight aria-hidden="true"/></button>
            {available && save.coins < offer.coins && <p className="bkl-pack-note">Earn {format.format(offer.coins - save.coins)} more BK Coins in Road to Legend.</p>}
          </>}
        </>}
        {save.pack?.choices ? <section className="bkl-pack-reveal" aria-label="Choose your player">
          <h2>Choose your player</h2>
          <div className="bkl-pack-player-grid">{save.pack.choices.map(id => {
            const card = CARD_BY_ID.get(id)!;
            return <article className="bkl-pack-choice" key={id}>
              <DepthPortrait id={id}/>
              <strong>{card.overall} OVR</strong><h3>{card.name}</h3>
              <button type="button" onClick={() => change(state => claimPack(state, id), 'Player added to your collection.')}>Claim</button>
            </article>;
          })}</div>
        </section> : save.pack && pendingTier && <>
          <img className="bkl-pack-sealed" src={'/images/bk-legends-pack-' + pendingTier + '.webp'} alt="" width={240} height={400}/>
          <h2>{save.pack.position} {PACK_TIERS[pendingTier].label} Pack</h2>
          {pendingTier === 'good' && packOptionCount(save.pack.position, 'elite') >= 3 &&
            <button type="button" disabled={save.coins < PREMIUM_PRICE} onClick={() => change(boostPack, 'Elite Pack ready to open.')}>Upgrade to Elite · {format.format(PREMIUM_PRICE)} BK Coins</button>}
          <button type="button" className="bkl-gold" onClick={() => change(state => revealPack(state))}>Open pack <ArrowRight aria-hidden="true"/></button>
        </>}
      </section>}
      {section === 'Training' && <section className="bkl-panel bkl-art-panel">
        <header className="bkl-tab-art bkl-training-art">
          <p className="bkl-kicker"><Dumbbell aria-hidden="true"/> {format.format(save.training)} Training Points</p>
          <h1>Training Ground</h1>
        </header>
        <p>Win a drill to earn 100 Training Points. Spend them in My Squad to upgrade a starter.</p>
        <div className="bkl-drills">{TRAINING.map(drill => <div key={drill.id}><div><h2>{drill.title}</h2><p>{goalText(drill)}</p></div><button onClick={() => launch(drill)}>Play drill</button></div>)}</div>
      </section>}
      {section === 'Exchange' && <section className="bkl-panel bkl-art-panel">
        <header className="bkl-tab-art bkl-exchange-art">
          <p className="bkl-kicker"><Shield aria-hidden="true"/> {duplicates(save)} spare copies</p>
          <h1>Player Exchange</h1>
        </header>
        <p>Trade any 3 spare copies for the player shown. Your first copy of every card stays in your collection.</p>
        <PositionPicker position={position} onChange={setPosition}/>
        {exchangeTarget && <PlayerCard id={exchangeTarget} action={save.owned[exchangeTarget] ? 'Already owned' : 'Exchange 3 spare copies'} disabled={Boolean(save.owned[exchangeTarget]) || duplicates(save) < 3} onAction={() => change(state => exchangeCard(state, position), 'Exchange complete. Player added to your collection.')}/>}
      </section>}
    </>}
    <p className="bkl-save-note">BK Legends progress and campaign coins are saved on this device.</p>
    {attempt && <dialog ref={dialog} className="bkl-field" aria-label={attempt.scenario.title} onCancel={event => { event.preventDefault(); setAttempt(null); }}>
      <header><span><strong>{attempt.scenario.title}</strong><small>{ghostAttempt && save.ghostBest && !outcome
        ? `Best to beat · ${driveTime(save.ghostBest.elapsedMs)} · ${save.ghostBest.plays} plays`
        : goalText(attempt.scenario)}</small></span>
        <button aria-label="Leave challenge" onClick={() => setAttempt(null)}><X aria-hidden="true"/></button></header>
      {outcome ? <div className="bkl-field-result"><h2>{outcome.passed ? 'Challenge cleared' : 'Objective incomplete'}</h2>
        <p>Final score · BK Legends {outcome.result.homeScore}–{outcome.result.awayScore} {opponentName(attempt.scenario)}</p>
        <dl className="bkl-field-stats" aria-label="Challenge stats">
          <div><dt>Passing yards</dt><dd>{outcome.result.passYards}{attempt.scenario.goal === 'pass' ? ` / ${attempt.scenario.target}` : ''}</dd></div>
          <div><dt>Rushing yards</dt><dd>{outcome.result.rushYards}{attempt.scenario.goal === 'rush' ? ` / ${attempt.scenario.target}` : ''}</dd></div>
          <div><dt>{attempt.scenario.goal === 'shutout' ? 'Points allowed' : 'Plays'}</dt><dd>{attempt.scenario.goal === 'shutout' ? outcome.result.awayScore - attempt.scenario.awayScore : outcome.result.plays}</dd></div>
        </dl>
        {ghostAttempt ? <>
          {outcome.result.ghost && <p>{outcome.newBest ? 'New personal best' : 'Drive time'} · {driveTime(outcome.result.ghost.drive.elapsedMs)}
            {attempt.ghostTargetMs !== undefined && ` · Target ${driveTime(attempt.ghostTargetMs)}`}</p>}
          {outcome.receiverProgress?.map(({ id, wins }) => <strong key={id}>{CARD_BY_ID.get(id)?.name}
            {wins === GHOST_TRAIT_WINS ? ' earned Clutch Receiver.' : ` · Clutch Receiver ${wins}/${GHOST_TRAIT_WINS}`}</strong>)}
          {!outcome.passed && <p>{goalText(attempt.scenario)}</p>}
        </> : outcome.persisted ? <strong>{attempt.scenario.id < 0 ? '+100 Training Points' : '+1,000 BK Coins'}</strong> : outcome.passed ? <p>This attempt did not add a reward. Check your campaign progress and device storage.</p> : <p>{goalText(attempt.scenario)}</p>}
        {outcome.persisted && attempt.scenario.id % 10 === 9 && <p>
          {attempt.scenario.id === CAMPAIGN.length - 1 ? 'Chapter Pack and Legacy Pack unlocked.' : 'Chapter Pack unlocked.'}
        </p>}
        {(ghostAttempt || !outcome.passed) && <button onClick={() => launch(attempt.scenario)}>{ghostAttempt && outcome.passed ? 'Play again' : 'Try again'}</button>}
        <button className="bkl-gold" onClick={() => setAttempt(null)}>Back to BK Legends</button>
      </div> : fieldFailed ? <div className="bkl-field-result"><h2>The field couldn’t load</h2><button className="bkl-gold" onClick={() => launch(attempt.scenario)}>Try again</button></div>
        : <iframe key={attempt.token} ref={field} title="BK Legends 3D football field" src={fieldUrl(attempt)} allow="fullscreen; autoplay"/>}
    </dialog>}
  </div>;
}

function GhostDriveSummary({ drive }: { drive: NonNullable<LegendsState['ghostBest']> }) {
  return <details className="bkl-ghost-summary">
    <summary>Personal best · {driveTime(drive.elapsedMs)} · {drive.plays} {drive.plays === 1 ? 'play' : 'plays'}</summary>
    <ol>{drive.steps.map((step, index) => <li key={index}>
      <span>{step.reason}{step.gain !== null && ` · ${step.gain} yd`}</span><time dateTime={`PT${step.elapsedMs / 1000}S`}>{driveTime(step.elapsedMs)}</time>
    </li>)}</ol>
  </details>;
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
