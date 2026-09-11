import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProfileLockerView } from '../ProfileLockerView';
import { profileDate, profileNumber, profileXpProgress, signedProfileDelta } from '../profileLockerState';
import type { Achievement, ProgressEvent, ProgressProfile } from '../progressionCloud';
import type { VerifiedPredictionPick } from '../modeProgressionCloud';

const profile: ProgressProfile = { userId: 'fixture', displayName: 'Fixture GM', bkRating: 50, xp: 550, level: 1, footballIq: 50, gmRating: 51, predictionRating: 48, triviaRating: 49, agentRating: 52, ownerRating: 50, championships: 0, currentStreak: 0, longestStreak: 0, updatedAt: '2026-09-08T12:00:00Z' };
const achievements: Achievement[] = Array.from({ length: 7 }, (_, index) => ({ key: `fixture-${index}`, title: `Fixture trophy ${index}`, description: `Verified milestone ${index}`, category: 'gm', tier: index % 2 ? 'silver' : 'gold', xpReward: 100, ...(index === 1 ? { unlockedAt: '2026-09-08T12:00:00Z' } : {}) }));
const events: ProgressEvent[] = [{ id: 1, eventType: 'prediction_wrong', category: 'prediction', xpAwarded: 2, ratingDelta: -1, occurredAt: '2026-09-08T12:00:00Z', metadata: {} }];
const predictionPicks: VerifiedPredictionPick[] = [
  { id: 'pick-1', gameId: 'game-1', label: 'PHI -3', market: 'spread', selection: 'Philadelphia Eagles', lockedLine: -3, lockedAt: '2026-09-06T12:00:00Z', result: 'win', awayTeam: 'Philadelphia Eagles', homeTeam: 'Dallas Cowboys', kickoffAt: '2026-09-06T20:00:00Z', gradedAt: '2026-09-07T00:00:00Z' },
  { id: 'pick-2', gameId: 'game-2', label: 'BUF -2.5', market: 'spread', selection: 'Buffalo Bills', lockedLine: -2.5, lockedAt: '2026-09-05T12:00:00Z', result: 'win', awayTeam: 'Buffalo Bills', homeTeam: 'Miami Dolphins', kickoffAt: '2026-09-05T20:00:00Z', gradedAt: '2026-09-06T00:00:00Z' },
  { id: 'pick-3', gameId: 'game-3', label: 'NYJ +4', market: 'spread', selection: 'New York Jets', lockedLine: 4, lockedAt: '2026-09-04T12:00:00Z', result: 'loss', awayTeam: 'New York Jets', homeTeam: 'New England Patriots', kickoffAt: '2026-09-04T20:00:00Z', gradedAt: '2026-09-05T00:00:00Z' },
];
const render = (overrides = {}) => renderToStaticMarkup(React.createElement(ProfileLockerView, { profile, achievements, events, predictionPicks, loading: false, error: '', onRefresh: () => {}, ...overrides }));

assert.equal(profileXpProgress(0, 1)?.percent, 0);
assert.equal(profileXpProgress(550, 1)?.percent, 55.00000000000001);
assert.equal(profileXpProgress(1000, 2)?.earned, 0);
assert.equal(profileXpProgress(1450, 2)?.nextTotal, 2000);
assert.equal(profileXpProgress(999, 1)?.earned, 999);
assert.equal(profileXpProgress(1000, 1), null, 'Do not display fabricated progress for inconsistent server data');
for (const invalid of [-1, NaN, Infinity]) assert.equal(profileXpProgress(invalid, 1), null);
assert.equal(profileXpProgress(0, 0), null);
assert.equal(profileNumber(undefined), '—');
assert.equal(profileNumber(0), '0');
assert.equal(signedProfileDelta(-2), '-2');
assert.equal(signedProfileDelta(3), '+3');
assert.equal(profileDate('bad date'), '');

const html = render();
assert.equal((html.match(/class="bk-locker-hex"/g) || []).length, 6);
assert.equal((html.match(/class="bk-locker-trophy"/g) || []).length, 8, 'Prediction record should lead the complete trophy catalog');
assert.match(html, /1\/7 unlocked/);
assert.match(html, /2 correct picks/);
assert.match(html, /Pick Record/);
assert.match(html, /2 correct NFL picks all time/);
assert.match(html, /aria-valuenow="550"/);
assert.match(html, /Level 2 at 1,000 XP/);
assert.match(html, /-1 RTG/);
assert.doesNotMatch(html, /\+-1/);
assert.match(html, /Fixture trophy 6/);
assert.match(html, /Server controlled/);
assert.match(html, /role="img" aria-label="Rating: 50"/);
assert.match(html, /clipPathUnits="userSpaceOnUse"/);
const zero = render({ profile: { ...profile, xp: 0, championships: 0 }, events: [], achievements: [], predictionPicks: [] });
assert.match(zero, /aria-valuenow="0"/);
assert.match(zero, /0 correct picks/);
assert.match(zero, /No verified progression receipts yet/);
const unavailable = render({ profile: null, events: [], achievements: [], predictionPicks: [], error: 'Offline' });
assert.doesNotMatch(unavailable, /role="progressbar"|No verified progression receipts yet/);
assert.match(unavailable, /temporarily unavailable/);
assert.match(unavailable, /role="alert"/);
assert.match(render({ loading: true, profile: null, events: [], achievements: [], predictionPicks: [] }), /Loading verified progression receipts/);
assert.doesNotMatch(html, /0\.1 DAILY|1,245|Connect platforms/i, 'Never copy invented mockup rewards or counts');
const source = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
assert.match(source('LockerHub.tsx'), /<ProfilePhotoEditor\b[^>]*\/>/);
assert.match(source('LockerHub.tsx'), /equipLockerItem/);
assert.match(source('LockerHub.tsx'), /ownedCollectibles/);
assert.match(source('ProgressionProfileCard.tsx'), /gradeVerifiedPredictionPicks/);
assert.match(source('ProgressionProfileCard.tsx'), /version !== requestVersion\.current/);
assert.match(source('ProgressionProfileCard.tsx'), /key=\{currentUser\?\.id/);
assert.match(source('ProfileLockerView.tsx'), /predictionHistoryOpen/);
assert.match(source('ProfileLockerView.tsx'), /Correct|Missed|Pending/);
assert.match(source('profileLocker.css'), /prefers-reduced-motion:reduce/);
assert.match(source('profileLocker.css'), /scroll-snap-type:x proximity/);
assert.ok(statSync(new URL('../public/profile/locker-reference-atlas.webp', import.meta.url)).size < 32768, 'Reference art must remain a small local asset');
assert.ok(statSync(new URL('../public/profile/locker-manager-face.webp', import.meta.url)).size < 8192, 'Manager face overlay must remain a small local asset');
assert.match(source('ProfileLockerArt.tsx'), /LockerReceiptScene/);
assert.match(source('LockerHub.tsx'), /<details className="bk-profile-extras"/);
assert.match(source('profileLocker.css'), /body:has\(\.bk-app-shell\[data-tab="locker"\]\)/);
console.log('Profile locker contracts passed: true XP thresholds, 6 ratings, prediction record history, full trophy catalog, signed receipts, loading/errors, unchanged photo entrypoint, scoped art and account reads.');
