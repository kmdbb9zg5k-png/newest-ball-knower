import assert from 'node:assert/strict';
import { buildDraftCreationSchedule, canStartScheduledDraft, formatDraftSchedule, getDraftScheduledTime } from '../draftSchedule';

const previousTimezone = process.env.TZ;
try {
  process.env.TZ = 'America/New_York';
  const now = Date.parse('2026-11-06T20:00:00-05:00');
  const immediate = buildDraftCreationSchedule('now', '', '', now);
  assert.equal(immediate.draftScheduledAt, null, 'Draft Now must not require a hidden date or save a fabricated future time');
  assert.equal(immediate.draftTimezone, 'America/New_York');
  const restored = JSON.parse(JSON.stringify({ settings: immediate }));
  assert.equal(getDraftScheduledTime(restored), null);
  assert.equal(canStartScheduledDraft(restored, now), true, 'A restored Draft Now league must not regain a future-date gate');
  assert.equal(formatDraftSchedule(restored), null);

  const scheduled = buildDraftCreationSchedule('scheduled', '2026-11-07', '20:00', now);
  assert.equal(scheduled.draftScheduledAt, '2026-11-08T01:00:00.000Z');
  assert.equal(canStartScheduledDraft({ settings: scheduled }, now), false);
  assert.equal(canStartScheduledDraft({ settings: scheduled }, Date.parse(scheduled.draftScheduledAt!)), true);
  assert.ok(formatDraftSchedule({ settings: scheduled })?.includes('EST'));
  for (const [day, time] of [['', ''], ['bad', '20:00'], ['2026-11-06', '19:59'], ['2026-11-06', '20:00'], ['2026-11-07', '25:00'], ['2027-02-30', '20:00'], ['2027-03-14', '02:30']]) {
    assert.throws(() => buildDraftCreationSchedule('scheduled', day, time, now), /valid draft date and time in the future/, `${day} ${time} must not silently become a different or past draft time`);
  }
  assert.equal(buildDraftCreationSchedule('scheduled', '2027-03-14', '03:30', now).draftScheduledAt, '2027-03-14T07:30:00.000Z');
  process.env.TZ = 'UTC';
  assert.equal(buildDraftCreationSchedule('scheduled', '2026-11-07', '20:00', now).draftScheduledAt, '2026-11-07T20:00:00.000Z');
  console.log('Draft creation timing checks passed: immediate persistence, schedule gate, local timezone, past/invalid dates and daylight-saving gaps.');
} finally {
  if (previousTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = previousTimezone;
}
