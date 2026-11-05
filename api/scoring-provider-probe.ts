// Temporary preview diagnostic. Remove this route before the production merge.
import identities from '../data/independent-football-inputs.json' with {type:'json'};
import {createScoringProviderProbe} from '../server/bk/scoring-provider-probe.js';
export const config={maxDuration:30};
export default createScoringProviderProbe({identities});
