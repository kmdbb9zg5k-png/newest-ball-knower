import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const hub = readFileSync(new URL('../ChallengesHub.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../gauntlet.css', import.meta.url), 'utf8');

for (const mode of ['TRIVIA', 'FILM ROOM', 'PREDICTIONS', 'DEBATES', 'SURVIVOR']) {
  assert.ok(hub.includes(`name:'${mode}'`), `The approved Gauntlet board is missing ${mode}.`);
}

assert.ok(hub.includes('progress.level') && hub.includes('progress.xp'), 'Level and XP must use real progress state.');
assert.ok(hub.includes('progress.currentStreak') && hub.includes('progress.longestStreak'), 'Streak cards must use real progress state.');
assert.ok(hub.includes('progress.totalCorrect/progress.totalAnswered'), 'Accuracy must be derived from real answers.');
assert.ok(hub.includes('progress.highScores') && hub.includes('progress.daily[dailyDate]'), 'Mode bests and daily status must use persisted progress.');
assert.ok(hub.includes('setDailyRun(true)') && hub.includes('buildDailyGauntlet(dailyDate)'), 'The daily CTA must start the real shared daily run.');
assert.ok(hub.includes("if(tierPickerMode==='TRIVIA')openTrivia(item.name)"), 'Classic Trivia difficulty must keep the server-backed question flow.');
assert.ok(hub.includes('setActiveRun({mode:tierPickerMode'), 'Scenario modes must keep the existing Gauntlet engine.');
assert.ok(hub.includes('<ModeGuide') && hub.includes('tierPickerMode&&<ModalPortal>'), 'The redesigned hub must preserve help and an accessible difficulty dialog.');

for (const selector of ['.bk-gauntlet-frame', '.bk-gauntlet-hero', '.bk-gauntlet-stats', '.bk-gauntlet-board', '.bk-gauntlet-daily-cta', '.bk-gauntlet-tier-sheet']) {
  assert.ok(styles.includes(selector), `Missing approved Trivia visual primitive ${selector}.`);
}

assert.ok(styles.includes('grid-template-columns: repeat(5, minmax(0, 1fr))'), 'Five progress stats must remain in one compact mobile row.');
assert.ok(styles.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'), 'Challenge modes must retain the approved two-column composition.');
assert.ok(styles.includes('padding: 18px 15px calc(82px + env(safe-area-inset-bottom))'), 'Difficulty controls must clear the mobile bottom navigation and safe area.');
assert.ok(styles.includes('@media (max-width: 359px)') && styles.includes('@media (min-width: 640px)'), 'Trivia must include narrow-phone and desktop adaptations.');
assert.ok(styles.includes('@media (prefers-reduced-motion: reduce)'), 'Trivia must honor Reduce Motion.');

console.log('Trivia visual fidelity passed: live progress, five modes, difficulty flow, daily challenge, gold arena composition, safe areas, and Reduce Motion.');
