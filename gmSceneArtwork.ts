import type { FranchiseScenarioKind } from './franchiseInteractions';

export const GM_SCENES = ['office', 'gameplan', 'trade', 'role', 'breakout', 'mentor', 'trust', 'leadership', 'media', 'medical', 'draft', 'playoffs', 'review', 'champion'] as const;
export type GmScene = typeof GM_SCENES[number];
export const GM_MEETING_SCENES: Record<FranchiseScenarioKind, GmScene> = {
  playing_time: 'role', breakout: 'breakout', mentor: 'mentor', trust_repair: 'trust',
  leadership: 'leadership', media_pressure: 'media', recovery: 'medical',
};
export const GM_ALERT_SCENES = { trade: 'trade', injury: 'medical', relationship: 'role', development: 'breakout' } as const;
export const gmSceneUrl = (scene: GmScene) => `/gm-scenes/${scene}-v1.webp`;
