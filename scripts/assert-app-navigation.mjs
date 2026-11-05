import assert from 'node:assert/strict';

const PRIMARY_LABELS = ['Home', 'Play', 'Fantasy', 'Community', 'Profile'];
const SECONDARY_LABELS = ['Solo careers', 'Online football', 'Trivia', 'NFL picks', 'NFL news', 'Ask BK', 'Hall of Fame', 'Partners', 'Player locker', 'Create League', 'Join League', 'Roster Database', 'Replay Opening'];

/** Shared browser contract: five primary choices and every retained destination. */
export async function assertAppNavigation(page, { mobile }) {
  const primary = page.getByRole('navigation', { name: mobile ? 'Primary navigation' : 'Desktop primary navigation', exact: true });
  assert.deepEqual((await primary.getByRole('button').allTextContents()).map(text => text.trim()), PRIMARY_LABELS);
  const trigger = page.getByRole('button', { name: 'Explore Ball Knower', exact: true });
  await trigger.click();
  const explore = page.getByRole('dialog', { name: 'Explore Ball Knower', exact: true });
  await explore.waitFor({ state: 'visible' });
  for (const label of SECONDARY_LABELS) {
    const button = explore.getByRole('button', { name: new RegExp(`^${label}`, 'i') });
    assert.equal(await button.count(), 1, `${label} must remain reachable in Explore`);
    assert.ok(await button.isVisible(), `${label} must be a visible menu choice`);
  }
  await page.keyboard.press('Escape');
  await explore.waitFor({ state: 'hidden' });
  assert.ok(await trigger.evaluate(element => element === document.activeElement), 'Escape must restore focus to Explore');
}

/** Use this for secondary routes rather than looking for a permanent bottom tab. */
export async function navigateFromExplore(page, label, tab) {
  await page.getByRole('button', { name: 'Explore Ball Knower', exact: true }).click();
  await page.getByRole('dialog', { name: 'Explore Ball Knower', exact: true }).getByRole('button', { name: new RegExp(`^${label}`, 'i') }).click();
  await page.locator(`.bk-app-shell[data-tab="${tab}"]`).waitFor({ state: 'visible' });
}
