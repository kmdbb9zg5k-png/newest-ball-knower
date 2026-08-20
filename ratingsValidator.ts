import { Player, RatingsValidationReport } from './types';
import { MADDEN_RATING_METADATA, OFFICIAL_MADDEN_RATINGS } from './maddenRatings';

/**
 * Validates player ratings against the official EA SPORTS Madden ratings source of truth.
 * Checks for missing/duplicate/out-of-bounds ratings, legacy discrepancies,
 * rating source consistency, and rating-season alignment.
 */
export function validatePlayerRatings(players: Player[]): RatingsValidationReport {
  const flaggedErrors: string[] = [];
  const flaggedWarnings: string[] = [];
  const checkedPlayerIds = new Set<string>();
  const reviewPlayerIds = new Set<string>();

  let ratingsVerifiedCount = 0;
  let ratingsUpdatedCount = 0;
  let ratingsUnchangedCount = 0;
  let missingRatingsCount = 0;
  let legacyRatingsRemovedCount = 0;

  const validPlayers: Player[] = [];
  const club99Players: Player[] = [];

  const markForReview = (playerId: string) => reviewPlayerIds.add(playerId);

  for (const player of players) {
    const pId = player.playerId || player.id;

    if (checkedPlayerIds.has(pId)) {
      flaggedErrors.push(`Duplicate player ID found in ratings validation: ${pId} (${player.name})`);
      markForReview(pId);
    } else {
      checkedPlayerIds.add(pId);
    }

    if (typeof player.overallRating !== 'number' || isNaN(player.overallRating) || player.overallRating < 0 || player.overallRating > 99) {
      flaggedErrors.push(`Player ${player.name} (${pId}) has invalid rating value: ${player.overallRating}`);
      missingRatingsCount++;
      markForReview(pId);
      continue;
    }

    const sourceMatches = player.ratingSource === MADDEN_RATING_METADATA.ratingSource;
    if (!sourceMatches) {
      flaggedWarnings.push(`Player ${player.name} (${pId}) has rating source ${player.ratingSource ?? 'missing'}; expected ${MADDEN_RATING_METADATA.ratingSource}.`);
      markForReview(pId);
    }

    const seasonMatches = String(player.ratingSeason ?? '') === String(MADDEN_RATING_METADATA.ratingSeason);
    if (!seasonMatches) {
      flaggedWarnings.push(`Player ${player.name} (${pId}) has rating season ${player.ratingSeason ?? 'missing'}; expected ${MADDEN_RATING_METADATA.ratingSeason}.`);
      markForReview(pId);
    }

    if (player.ratingStatus === 'RATING_REVIEW_REQUIRED') {
      markForReview(pId);
      flaggedWarnings.push(`Player ${player.name} (${pId}) is flagged as RATING_REVIEW_REQUIRED.`);
    }

    if (player.legacyRatingRemoved) legacyRatingsRemovedCount++;
    if (player.overallRating === 99) club99Players.push(player);

    const dictMatch = OFFICIAL_MADDEN_RATINGS[pId];
    if (!dictMatch) {
      flaggedErrors.push(`Player ${player.name} (${pId}) has no official Madden rating record.`);
      markForReview(pId);
    } else if (dictMatch.overallRating !== player.overallRating) {
      flaggedErrors.push(`Player ${player.name} (${pId}) rating mismatch: app ${player.overallRating}, official ${dictMatch.overallRating}.`);
      markForReview(pId);
    } else {
      ratingsVerifiedCount++;
      const previousOvr = dictMatch.previousOvr;
      if (typeof previousOvr === 'number' && previousOvr !== dictMatch.overallRating) ratingsUpdatedCount++;
      else ratingsUnchangedCount++;
    }

    validPlayers.push(player);
  }

  const playersRequiringReviewCount = reviewPlayerIds.size;
  const sorted = [...validPlayers].sort((a, b) => (b.overallRating ?? b.ovr) - (a.overallRating ?? a.ovr));
  const highestRatedPlayers = sorted.slice(0, 10);
  const lowestRatedPlayers = [...sorted].reverse().slice(0, 10);

  const sourceMismatchCount = players.filter(player => player.ratingSource !== MADDEN_RATING_METADATA.ratingSource).length;
  const seasonMismatchCount = players.filter(player => String(player.ratingSeason ?? '') !== String(MADDEN_RATING_METADATA.ratingSeason)).length;
  const isValid =
    flaggedErrors.length === 0 &&
    missingRatingsCount === 0 &&
    ratingsVerifiedCount === players.length &&
    playersRequiringReviewCount === 0 &&
    sourceMismatchCount === 0 &&
    seasonMismatchCount === 0;

  const notableRatingUpdates = validPlayers
    .map(player => {
      const pId = player.playerId || player.id;
      const official = OFFICIAL_MADDEN_RATINGS[pId];
      if (!official || typeof official.previousOvr !== 'number' || official.previousOvr === official.overallRating) return null;
      return {
        name: player.name,
        team: player.team,
        position: player.position,
        note: player.legacyRatingRemoved ? 'Legacy rating removed and synchronized.' : 'Rating synchronized to current Madden data.',
        legacyOvr: official.previousOvr,
        officialOvr: official.overallRating,
      };
    })
    .filter((update): update is NonNullable<typeof update> => update !== null)
    .slice(0, 6);

  const checks: RatingsValidationReport['checks'] = [
    {
      name: 'Rating coverage',
      description: `${ratingsVerifiedCount}/${players.length} active players match an official Madden rating record.`,
      status: ratingsVerifiedCount === players.length ? 'PASSED' : 'FAILED',
    },
    {
      name: 'Missing ratings',
      description: missingRatingsCount === 0 ? 'No active player is missing an OVR.' : `${missingRatingsCount} players are missing ratings.`,
      status: missingRatingsCount === 0 ? 'PASSED' : 'FAILED',
    },
    {
      name: 'Duplicate IDs',
      description: flaggedErrors.some(error => error.includes('Duplicate player ID')) ? 'Duplicate player identities detected.' : 'No duplicate rating identities detected.',
      status: flaggedErrors.some(error => error.includes('Duplicate player ID')) ? 'FAILED' : 'PASSED',
    },
    {
      name: 'Rating source alignment',
      description: sourceMismatchCount === 0 ? 'All active players use the configured Madden rating source.' : `${sourceMismatchCount} players have a missing or mismatched rating source.`,
      status: sourceMismatchCount === 0 ? 'PASSED' : 'FAILED',
    },
    {
      name: 'Rating season alignment',
      description: seasonMismatchCount === 0 ? 'All active players use the configured rating season.' : `${seasonMismatchCount} players have a missing or mismatched rating season.`,
      status: seasonMismatchCount === 0 ? 'PASSED' : 'FAILED',
    },
    {
      name: 'Review queue',
      description: playersRequiringReviewCount === 0 ? 'No ratings require manual review.' : `${playersRequiringReviewCount} ratings require review.`,
      status: playersRequiringReviewCount === 0 ? 'PASSED' : 'FAILED',
    },
  ];

  return {
    totalPlayersChecked: players.length,
    ratingsVerifiedCount,
    ratingsUpdatedCount,
    ratingsUnchangedCount,
    missingRatingsCount,
    legacyRatingsRemovedCount,
    playersRequiringReviewCount,
    ratingSource: MADDEN_RATING_METADATA.ratingSource,
    ratingSeason: MADDEN_RATING_METADATA.ratingSeason,
    lastAuditTimestamp: MADDEN_RATING_METADATA.lastUpdated,
    isValid,
    highestRatedPlayers,
    lowestRatedPlayers,
    flaggedErrors,
    flaggedWarnings,
    maddenClub99: club99Players,
    ratingsStatus: isValid ? 'PASSED' : 'REVIEW REQUIRED',
    lastUpdated: MADDEN_RATING_METADATA.lastUpdated,
    updatedFromLegacyCount: ratingsUpdatedCount,
    unchangedCount: ratingsUnchangedCount,
    flaggedForReviewCount: playersRequiringReviewCount,
    madden99Club: club99Players,
    notableRatingUpdates,
    checks,
  };
}
