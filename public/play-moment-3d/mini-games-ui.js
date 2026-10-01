import { createFullGameUI } from './five-minute-ui.js?v=contact-polish-4';
import { miniClock, saveMiniBest } from './mini-games.js?v=contact-polish-4';

export function createMiniGamesUI(config, actions) {
  if (!config) return null;
  if (config) return createFullGameUI(config, actions);
  document.body.classList.add('mini-game');
  for(const side of ['home','away']){const team=config.matchup[side],club=document.querySelector('.club.'+side);club.querySelector('b').textContent=team.name.split(' ').slice(-1)[0].toUpperCase();club.querySelector('.crest').textContent=team.abbr;club.setAttribute('aria-label',team.name+', '+team.overall+' overall');club.style.borderBottomColor=team.secondary;club.querySelector('.crest').style.color=team.secondary;}

  document.title = 'Ball Knower | Two-Minute Drill';
  document.querySelector('#game').setAttribute('aria-label', 'Two-Minute Drill football field');
  document.querySelector('#loading span').textContent = 'Preparing Two-Minute Drill…';
  document.querySelector('#pause').setAttribute('aria-label', 'Pause Two-Minute Drill');
  document.querySelector('#rotate p').textContent = 'Rotate your phone to play Two-Minute Drill.';
  document.querySelector('#paused .eyebrow').textContent = `TWO-MINUTE DRILL · ${config.level.name.toUpperCase()}`;
  document.querySelector('#restart').textContent = 'TRY AGAIN';
  for (const link of document.querySelectorAll('a[href="/"]')) {
    link.href = '/?miniGames=1'; link.setAttribute('aria-label', 'Back to Mini Games');
    if (!link.classList.contains('icon')) link.textContent = 'Back to Mini Games';
  }
  const toolbar = document.createElement('div'); toolbar.id = 'miniActions';
  toolbar.innerHTML = '<span></span><div><button id="miniTimeout" type="button">TIMEOUT · 3</button><button id="miniSpike" type="button">SPIKE</button></div>';
  toolbar.querySelector('span').textContent = config.level.name.toUpperCase();
  document.querySelector('#hud header').append(toolbar);
  const timeout = toolbar.querySelector('#miniTimeout'), spike = toolbar.querySelector('#miniSpike');
  timeout.onclick = actions.timeout; spike.onclick = actions.spike;
  const summary = document.createElement('section'); summary.id = 'miniSummary';
  const resultActions = document.createElement('div'); resultActions.id = 'miniResultActions';
  resultActions.append(document.querySelector('#restart'), document.querySelector('#paused a'));
  document.querySelector('#dialogBody').after(resultActions, summary);
  let savedResult = null, best = null;
  return {
    reset() { savedResult = null; best = null; summary.replaceChildren(); },
    update(session, drive, phase, paused, ended, motion) {
      toolbar.hidden = ended || paused || !['pre', 'dead'].includes(phase);
      timeout.textContent = `TIMEOUT · ${session.timeouts}`;
      timeout.disabled = !session.running || session.timeouts <= 0 || !session.started || drive.clock <= 0;
      spike.disabled = phase !== 'pre' || motion || drive.clock <= 0;
      toolbar.querySelector('span').textContent = `${config.level.name.toUpperCase()} · PLAY :${String(Math.ceil(session.playClock)).padStart(2, '0')}`;
      toolbar.querySelector('span').setAttribute('aria-label', `${config.level.name}, play clock ${Math.ceil(session.playClock)} seconds`);
      document.querySelector('#clock').textContent = miniClock(drive.clock);
      document.querySelector('#watchReplay').hidden = true;
      document.querySelector('#paused .running-setting').hidden = ended;
    },
    result(session, drive) {
      const result = session.result;
      if (!result) return;
      if (savedResult !== result) {
        savedResult = result;
        try { best = saveMiniBest(localStorage, config.level.id, result, config.matchup.home.abbr + '-' + config.matchup.away.abbr); } catch { best = null; }
      }
      const stats = document.createElement('p');
      stats.textContent = `${config.matchup.home.abbr} ${drive.score}–${result.reason === 'SAFETY' ? 29 : 27} ${config.matchup.away.abbr} · ${result.plays} ${result.plays === 1 ? 'play' : 'plays'} · ${result.yards} yards · ${miniClock(result.remaining)} left`;
      summary.replaceChildren(stats);
      if (best !== null) { const record = document.createElement('p'); record.textContent = `${config.level.name} matchup best: ${miniClock(best)} remaining`; summary.append(record); }
      const details = document.createElement('details'), heading = document.createElement('summary'), list = document.createElement('ol');
      heading.textContent = 'Drive recap'; details.append(heading, list);
      for (const entry of session.log) { const li = document.createElement('li'); li.textContent = `${miniClock(entry.clock)} · ${entry.reason}${entry.gain === null ? '' : ` · ${entry.gain >= 0 ? '+' : ''}${entry.gain} yards`}`; list.append(li); }
      summary.append(details);
    },
  };
}
