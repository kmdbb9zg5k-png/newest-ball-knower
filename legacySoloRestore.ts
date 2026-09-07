import type {Player} from './types';

const LEGACY_BUDGET = 'Ball Knower legacy Solo run budget';
/** Offline Solo only: honor an already-accepted run budget across source changes.
 * Never use this to price online submissions, new drafts, or new acquisitions.
 * Identity and abilities come from the canonical independent model, not the save.
 */
export function restoreSoloPlayer(saved: Player, canonical: Player | undefined, legacyRun: boolean): Player | undefined {
  if (!canonical) return undefined;
  const salary = Number(saved.salary);
  if ((legacyRun || saved.salarySource === LEGACY_BUDGET) && Number.isFinite(salary) && salary >= 0 && salary <= 500) {
    return {...canonical, salary, salaryType:'estimated', salarySource:LEGACY_BUDGET};
  }
  return canonical;
}
