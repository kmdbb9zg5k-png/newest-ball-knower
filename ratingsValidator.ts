import type { Player, RatingsValidationReport } from './types';
import { BALL_KNOWER_RATING_METADATA } from './independentPlayerRatings';
/** Structural checks are not assertions of player skill or legal clearance. */
export function validatePlayerRatings(players:Player[]):RatingsValidationReport{
  const errors:string[]=[];const ids=new Set<string>();let missing=0;
  for(const p of players){
    if(ids.has(p.id))errors.push(`Duplicate player identity: ${p.id}`);ids.add(p.id);
    if(!Number.isFinite(p.overallRating)||p.overallRating!<0||p.overallRating!>99){missing++;errors.push(`Invalid rating: ${p.id}`);}
    if(p.ovr!==p.overallRating)errors.push(`Rating aliases disagree: ${p.id}`);
    if(!p.ratingSource?.startsWith('Ball Knower')||p.ratingSeason!==2026)errors.push(`Missing independent provenance: ${p.id}`);
  }
  const sorted=[...players].sort((a,b)=>b.ovr-a.ovr);const top=sorted.filter(p=>p.ovr===99);
  const low=players.filter(p=>p.ratingConfidence==='low').length;
  const checks:RatingsValidationReport['checks']=[
    {name:'Independent model structure',description:'All ratings must be finite, bounded and consistently attributed.',status:errors.length?'FAILED':'PASSED'},
    {name:'Estimation limits',description:`${low} low-confidence role-based estimates; no claim of measured blocking or athletic ability.`,status:'PASSED'},
  ];
  return {
    totalPlayersChecked:players.length,ratingsVerifiedCount:players.length-missing,
    ratingsUpdatedCount:0,ratingsUnchangedCount:0,missingRatingsCount:missing,legacyRatingsRemovedCount:players.length,
    playersRequiringReviewCount:errors.length,ratingSource:BALL_KNOWER_RATING_METADATA.ratingSource,ratingSeason:2026,
    lastAuditTimestamp:BALL_KNOWER_RATING_METADATA.lastUpdated,isValid:errors.length===0,
    highestRatedPlayers:sorted.slice(0,10),lowestRatedPlayers:sorted.slice(-10).reverse(),
    flaggedErrors:errors,flaggedWarnings:[`${low} low-confidence estimates. Structural validation does not validate predictive accuracy.`],
    maddenClub99:top,ratingsStatus:errors.length?'REVIEW REQUIRED':'PASSED',lastUpdated:BALL_KNOWER_RATING_METADATA.lastUpdated,
    updatedFromLegacyCount:0,unchangedCount:0,flaggedForReviewCount:errors.length,madden99Club:top,notableRatingUpdates:[],checks,
  };
}
