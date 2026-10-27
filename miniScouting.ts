import type {MiniGameId, MiniStats} from './miniChallenges';

/** Coaching cues describe recorded results without pretending to measure unseen inputs. */
export function scoutingAdvice(game: MiniGameId, stats: MiniStats): string {
  if (stats.dnf) return 'Finish a complete attempt first. Practice the controls, then return for a scored run.';
  if (game === 'dash') return 'Use the 10-yard split to track your start. Keep alternating strides steadily through the finish; compare splits using the same athlete.';
  if (game === 'shuttle') return stats.penalty > 0 ? 'Your result includes a turn penalty. Reach the turn marker before changing direction on your next attempt.' : 'Keep your turns clean and compare your next time using the same athlete.';
  if (game === 'broad-jump') return 'Focus on a controlled landing after your power and takeoff sequence. Change one timing choice at a time to see what improves distance.';
  if (game === 'bench') return 'Aim for complete repetitions with consistent press timing. Compare completed reps, not partial lifts.';
  if (game === 'two-minute' || game === 'five-minute') return stats.turnovers > 0 ? 'Protect possession: your last attempt included a turnover. Look for a safer passing window before forcing a deep throw.' : 'Points decide the result first. Use the remaining clock to turn field position into a scoring opportunity.';
  if (game === 'db') return 'Keep your coverage position before attempting the interception. A clean stop still contributes to your evaluation.';
  if (game === 'career') return 'Review your weekly raw tape and film answers. Match preparation to fatigue before your next three-week audition.';
  return 'Complete every rep and prioritize consistent execution. Your average across the session decides the result.';
}
