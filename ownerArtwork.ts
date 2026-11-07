export const OWNER_SCENES = ['suite', 'stadium', 'league', 'draft', 'medical', 'press', 'fans', 'community', 'business', 'legal', 'locker', 'staff', 'practice', 'equipment', 'travel', 'security', 'media', 'weather', 'heritage', 'podium'] as const;
export type OwnerScene = typeof OWNER_SCENES[number];

/** Deliberate editorial mapping: new authored stories must receive a matching scene. */
export const OWNER_STORY_SCENES: Record<string, OwnerScene> = {
  'star-trade-demand': 'press', 'stadium-partnership': 'stadium',
  'rule-change-vote': 'league', 'coach-lost-room': 'locker',
  'ticket-price-surge': 'fans', 'draft-quarterback': 'draft',
  'gm-board-leak': 'draft', 'medical-protocol': 'medical',
  'international-home-game': 'league', 'stadium-naming-rights': 'business',
  'legend-public-feud': 'heritage', 'practice-facility-land': 'stadium',
  'analytics-department': 'draft', 'coordinator-poached': 'staff',
  'concession-boycott': 'fans', 'union-grievance': 'legal',
  'scout-misconduct': 'legal', 'cap-restructure': 'business',
  'tampering-accusation': 'legal', 'throwback-uniform': 'equipment',
  'field-surface': 'stadium', 'weather-roof': 'weather',
  'community-land': 'fans', 'charity-audit': 'legal',
  'local-broadcast': 'media', 'player-social-post': 'locker',
  'backup-quarterback': 'practice', 'playoff-injury': 'medical',
  'scouts-vs-model': 'draft', 'draft-clock-trade': 'draft',
  'suite-sponsor': 'suite', 'minority-investment': 'business',
  'cybersecurity-breach': 'security', 'betting-sponsor': 'business',
  'international-pathway': 'draft', 'flag-football': 'community',
  'alumni-health-fund': 'medical', 'camp-holdout': 'locker',
  'rookie-hazing': 'locker', 'stadium-workers': 'legal',
  'coach-extension': 'staff', 'gm-firing-rumor': 'staff',
  'fan-equity': 'fans', 'memorial-patch': 'heritage',
  'streaming-rights': 'media', 'schedule-flex': 'league',
  'evacuation-site': 'weather', 'equipment-failure': 'equipment',
  'player-conduct': 'legal', 'team-plane': 'travel',
  'practice-fight': 'practice', 'concussion-review': 'medical',
  'retired-number': 'heritage', 'rivalry-marketing': 'media',
  'executive-promotion': 'staff', 'suite-renovation': 'stadium',
  'youth-academy': 'community', 'green-stadium': 'stadium',
  'rookie-contract-error': 'business', 'veteran-retirement': 'heritage',
  'assistant-strike': 'staff', 'mascot-injury': 'medical',
  'owner-access': 'security', 'trade-physical': 'medical',
  'playoff-hosting': 'stadium', 'captain-vote': 'locker',
  'owner-apology': 'podium',
};

export const ownerSceneForDecision = (id: string): OwnerScene => OWNER_STORY_SCENES[id] ?? 'suite';
export const ownerScenePath = (scene: OwnerScene) => `/owner-scenes/${scene}-v1.webp`;
