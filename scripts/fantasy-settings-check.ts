import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const settings = read('FantasySettingsHub.tsx');
const home = read('HomeMatchups.tsx');
const management = read('LeagueManagementModal.tsx');

assert.match(home, /aria-label="Open fantasy settings"/, 'Home matchup heading must expose a labeled settings control.');
assert.match(home, /data-spoiler-free=/, 'Home matchup scores must honor the saved spoiler preference.');
for (const label of ['All My Leagues', 'Notifications', 'Display Preferences', 'Blocked & Muted', 'Help & League Rules']) {
  assert.ok(settings.includes(label), `Fantasy settings must include ${label}.`);
}
assert.ok(settings.includes('isLeagueCommissioner'), 'League settings must distinguish commissioner permissions.');
assert.ok(settings.includes('League Management') && settings.includes('Membership & Access'), 'Selected leagues must expose rules and access management.');
assert.match(management, /confirmationName\.trim\(\)!==league\.name\.trim\(\)/, 'Commissioner deletion must require the exact league name.');
assert.match(management, /league\.members\.length/, 'Commissioner deletion must disclose how many members are affected.');

console.log('Fantasy settings checks passed: mobile entry, all-league management, preferences, safety, help, and protected deletion.');
