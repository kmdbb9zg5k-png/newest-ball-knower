import { miniClock } from './mini-games.js?v=cpu-punts-7';
import { fieldGoalDistance } from './five-minute.js?v=cpu-punts-7';
const $ = id => document.getElementById(id);
const spot = ball => ball < 50 ? `OWN ${ball}` : ball === 50 ? 'MIDFIELD' : `OPP ${100 - ball}`;
const node = (tag, text, className) => { const el = document.createElement(tag); if (text != null) el.textContent = text; if (className) el.className = className; return el; };
export function createFullGameUI(config, actions) {
  const name = config.mode === 'two-minute' ? 'Two-Minute Warning' : 'Five-Minute Game';
  document.body.classList.add('mini-game', 'full-game');
  document.title = 'Ball Knower | '+name;
  $('game').setAttribute('aria-label', name+' football field');
  $('loading').querySelector('span').textContent = 'Preparing '+name+'…';
  $('rotate').querySelector('p').textContent = 'Rotate your phone to play '+name+'.';
  $('pause').setAttribute('aria-label', 'Pause '+name);
  $('paused').querySelector('.eyebrow').textContent = `${name.toUpperCase()} · ${config.level.name.toUpperCase()}`;
  $('restart').textContent = 'REMATCH';
  for (const side of ['home','away']) {
    const team = config.matchup[side], club = document.querySelector('.club.' + side);
    club.querySelector('b').textContent = team.name.split(' ').at(-1).toUpperCase(); club.querySelector('.crest').textContent = team.abbr;
    club.setAttribute('aria-label', team.name); club.style.borderBottomColor = team.secondary;
  }
  for (const link of document.querySelectorAll('a[href="/"]')) { link.href = '/?miniGames=1'; link.setAttribute('aria-label','Back to Mini Games'); if (!link.classList.contains('icon')) link.textContent = 'Pick New Teams'; }
  const toolbar = node('div'); toolbar.id = 'miniActions';
  toolbar.innerHTML = '<span></span><div><button id="miniTimeout" type="button">TIMEOUT · 3</button><button id="miniSpike" type="button">SPIKE</button></div>';
  document.querySelector('#hud header').append(toolbar);
  $('miniTimeout').onclick = actions.timeout; $('miniSpike').onclick = actions.spike;
  const kicks = node('div', null, 'full-kicks'); kicks.id = 'fullKicks';
  for (const [id, text, action] of [['fullPunt','PUNT',actions.punt],['fullFieldGoal','FIELD GOAL',actions.fieldGoal]]) { const button = node('button',text); button.id = id; button.type = 'button'; button.onclick = action; kicks.append(button); }
  document.querySelector('.playbook-footer').prepend(kicks);
  const panel = node('section'); panel.id = 'fullDefense'; panel.hidden = true; panel.setAttribute('aria-label','Simulated defense');
  const inner = node('div'); panel.append(inner);
  inner.innerHTML = '<div class="full-defense-heading"><div><span class="eyebrow">PLAY-BY-PLAY</span><h1 id="fullDefenseTitle" tabindex="-1">YOUR DEFENSE IS UP</h1><p id="fullDefenseSpot"></p></div><button id="fullAuto" type="button" aria-pressed="true">AUTO · ON</button></div><div id="fullLatest" role="status" aria-live="polite"></div><ol id="fullFeed" aria-label="Game play-by-play"></ol><div class="full-defense-actions"><button id="fullDefenseTimeout" type="button">TIMEOUT · 3</button><button id="fullPlayDefense" type="button">PLAY DEFENSE</button><button id="fullXP" type="button">KICK EXTRA POINT</button><button id="fullTwo" type="button">GO FOR TWO</button><button id="fullNext" type="button">NEXT PLAY →</button></div>';
  $('hud').after(panel);
  $('fullPlayDefense').onclick=actions.playDefense;$('fullXP').onclick=actions.extraPoint;$('fullTwo').onclick=actions.twoPoint;
  $('fullAuto').onclick = actions.auto; $('fullNext').onclick = actions.next; $('fullDefenseTimeout').onclick = actions.defenseTimeout;
  const summary = node('section'); summary.id = 'miniSummary';
  const resultActions = node('div'); resultActions.id = 'miniResultActions'; resultActions.append($('restart'), document.querySelector('#paused a'));
  $('dialogBody').after(resultActions,summary);
  let logCount = -1, wasVisible = false;
  const entryText = entry => `${entry.overtime ? 'OT' + entry.overtime : miniClock(entry.clock)} · ${config.matchup[entry.side || 'home'].abbr} · ${entry.reason}${entry.gain == null ? '' : ` · ${entry.gain >= 0 ? '+' : ''}${entry.gain} YDS`}`;
  return {
    reset() { summary.replaceChildren(); panel.hidden = true; logCount = -1; wasVisible = false; },
    update(s, d, phase, paused, ended, motion) {
      toolbar.hidden = Boolean(s.conversion) || ended || paused || !['pre','dead'].includes(phase);
      $('miniTimeout').textContent = `TIMEOUT · ${s.timeouts}`; $('miniTimeout').disabled = !s.running || s.timeouts <= 0 || !s.started;
      $('miniSpike').disabled = phase !== 'pre' || motion;
      toolbar.querySelector('span').textContent = `${config.level.name.toUpperCase()} · PLAY :${String(Math.ceil(s.playClock)).padStart(2,'0')}`;
      $('clock').textContent = s.overtime ? 'OT' + s.overtime : miniClock(d.clock);
      document.querySelector('.game-state>span').textContent = ended ? 'FINAL' : s.overtime ? 'EQUAL POSSESSIONS' : config.mode === 'two-minute' ? '2 MIN WARNING' : '5 MIN GAME';
      document.querySelector('.away strong').textContent = s.awayScore;
      document.querySelector('.club.home').classList.toggle('has-possession',s.possession === 'home');
      document.querySelector('.club.away').classList.toggle('has-possession',s.possession === 'away');
      $('watchReplay').hidden = true; document.querySelector('#paused .running-setting').hidden = ended;
      const distance = fieldGoalDistance(d.ball);
      kicks.hidden=Boolean(s.conversion);
      $('fullFieldGoal').textContent = `KICK FG · ${distance} YD`;
      $('fullFieldGoal').disabled = distance > 65 || phase !== 'pre' || paused || ended || motion;
      $('fullPunt').disabled = Boolean(s.overtime) || phase !== 'pre' || paused || ended || motion;
      $('fullPunt').textContent = s.overtime ? 'NO PUNTS IN OT' : 'PUNT';
      panel.hidden = phase !== 'cpu' || paused || ended;
      if (!panel.hidden) {
        $('fullPlayDefense').hidden=Boolean(s.conversion||s.kickoff||s.pending==='home');$('fullXP').hidden=s.conversion!=='home';$('fullTwo').hidden=s.conversion!=='home';$('fullNext').hidden=Boolean(s.conversion);$('fullAuto').hidden=Boolean(s.conversion||s.kickoff);
        $('fullDefenseTitle').textContent = s.conversion ? 'CHOOSE YOUR CONVERSION' : s.kickoff ? (s.kickoff==='home'?'KICKOFF':'RETURN THE KICKOFF') : s.pending === 'home' ? 'YOUR OFFENSE IS UP' : s.pending === 'away' ? 'YOUR DEFENSE IS UP' : 'DEFENSE ON THE FIELD';
        panel.classList.toggle('conversion',Boolean(s.conversion||s.kickoff));
        $('fullDefenseSpot').textContent = s.conversion ? `${config.matchup[s.conversion].name} · 1 point or 2 points` : s.kickoff ? `${config.matchup[s.kickoff].name} kicking` : s.pending ? `${config.matchup[s.pending].name} · ${spot(s.nextBall)}${s.overtime ? ' · OVERTIME' : ''}` : `${config.matchup.away.name} · ${s.cpu.down}${['ST','ND','RD','TH'][s.cpu.down-1] || 'TH'} & ${s.cpu.toGo} · ${spot(s.cpu.ball)}`;
        $('down').textContent = s.conversion ? 'TOUCHDOWN · CHOOSE CONVERSION' : s.kickoff ? (s.kickoff==='home'?'KICKOFF':'KICK RETURN') : s.pending ? 'POSSESSION CHANGE' : `CPU BALL · ${s.cpu.down} & ${s.cpu.toGo} · ${spot(s.cpu.ball)}`;
        $('fullNext').textContent = s.kickoff ? (s.kickoff==='home'?'KICK OFF →':'RETURN KICKOFF →') : s.pending === 'home' ? 'CALL YOUR PLAY →' : s.pending === 'away' ? (s.defenseMode==='play'?'CALL DEFENSE →':'WATCH DEFENSE →') : 'NEXT PLAY →';
        $('fullAuto').textContent = s.auto ? 'AUTO · ON' : 'AUTO · OFF'; $('fullAuto').setAttribute('aria-pressed',String(s.auto));
        $('fullAuto').disabled = Boolean(s.pending);
        $('fullDefenseTimeout').hidden=Boolean(s.conversion||s.kickoff);
        $('fullDefenseTimeout').textContent = `TIMEOUT · ${s.timeouts}`; $('fullDefenseTimeout').disabled = Boolean(s.pending) || s.timeouts <= 0 || s.overtime > 0 || s.defenseTimeout;
        if (s.log.length !== logCount) {
          logCount = s.log.length;
          const entries = s.log.slice(-30).reverse(); $('fullFeed').replaceChildren(...entries.slice(1).map(entry => node('li',entryText(entry))));
          $('fullLatest').textContent = entries[0] ? entryText(entries[0]) : 'Your defense is ready. Every CPU play appears here.';
        }
        if (!wasVisible) $('fullDefenseTitle').focus({preventScroll:true});
      }
      wasVisible = !panel.hidden;
    },
    result(s, d) {
      const score = node('p',`${config.matchup.home.abbr} ${d.score} — ${s.awayScore} ${config.matchup.away.abbr}`, 'full-final-score');
      const table = node('table',null,'full-final-stats');
      const head = node('thead'), tr = node('tr');
      for (const text of [config.matchup.home.abbr,'TEAM STATS',config.matchup.away.abbr]) tr.append(node('th',text)); head.append(tr); table.append(head);
      const body = node('tbody');
      for (const [key,label] of [['yards','Total yards'],['passYards','Net passing'],['rushYards','Rushing'],['plays','Offensive plays'],['touchdowns','Touchdowns'],['turnovers','Turnovers'],['sacks','Sacks allowed'],['fieldGoals','Field goals']]) {
        const row = node('tr'); row.append(node('td',s.stats.home[key]),node('th',label),node('td',s.stats.away[key])); body.append(row);
      }
      table.append(body); summary.replaceChildren(score,table);
      const mvp = s.result.mvp;
      summary.append(node('p',mvp ? `MVP · ${mvp.name} (${config.matchup[s.result.mvpSide].abbr}) · ${mvp.passYards} pass / ${mvp.rushYards} rush / ${mvp.receivingYards} receiving yards · ${mvp.touchdowns} TD · ${mvp.fieldGoals} FG` : `MVP · ${config.matchup[s.result.mvpSide].name} defense`));
      const players = node('details'); players.append(node('summary','Player stats'));
      for (const side of ['home','away']) { players.append(node('h3',config.matchup[side].name)); for (const p of Object.values(s.stats[side].players)) players.append(node('p',`${p.name} · ${p.completions}/${p.attempts} passing, ${p.passYards} pass / ${p.rushYards} rush / ${p.receivingYards} receiving yards, ${p.touchdowns} TD, ${p.fieldGoals} FG`)); }
      const recap = node('details'); recap.append(node('summary','Full game recap')); const list = node('ol'); for (const entry of s.log) list.append(node('li',entryText(entry))); recap.append(list); summary.append(players,recap);
    },
  };
}
