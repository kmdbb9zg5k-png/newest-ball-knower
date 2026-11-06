import identities from '../data/independent-football-inputs.json' with {type:'json'};
import {createScoringReadinessHandler} from '../server/bk/scoring-readiness.js';
export const maxDuration=15;
export default createScoringReadinessHandler({identities});
