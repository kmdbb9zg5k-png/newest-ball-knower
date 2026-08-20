import type { Player } from './types';
import './types';

declare module './types' {
  interface RatingsValidationReport {
    ratingsStatus: 'PASSED' | 'REVIEW REQUIRED';
    lastUpdated: string;
    updatedFromLegacyCount: number;
    unchangedCount: number;
    flaggedForReviewCount: number;
    madden99Club: Player[];
    notableRatingUpdates: Array<{
      name: string;
      team: string;
      position: string;
      note: string;
      legacyOvr: number;
      officialOvr: number;
    }>;
    checks: Array<{
      name: string;
      description: string;
      status: 'PASSED' | 'FAILED';
    }>;
  }
}

export {};
