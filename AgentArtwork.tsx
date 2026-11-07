import type { ClientEventKind } from './agentClientCareer';
import './agentArtwork.css';

export const AGENT_SCENES = {
  headquarters: 'headquarters', recruiting: 'recruiting', growth: 'growth',
  contract: 'contract', role: 'role', injury: 'injury', trade: 'trade',
  family: 'family', brand: 'brand', media: 'media',
} as const;
export type AgentScene = keyof typeof AGENT_SCENES;

export const AGENT_EVENT_SCENES: Record<ClientEventKind, AgentScene> = {
  playing_time: 'role', injury: 'injury', contract: 'contract',
  trade: 'trade', family: 'family', brand: 'brand',
};

/** Scene-setting photography, separate from the persistent player portraits. */
export function AgentArtwork({ scene, compact = false, caption }: {
  scene: AgentScene; compact?: boolean; caption?: string;
}) {
  return <div className={`bk-agent-art${compact ? ' bk-agent-art--compact' : ''}`} data-agent-scene={scene}>
    <img src={`/agent-scenes/${AGENT_SCENES[scene]}-v1.webp`} alt="" width={1280} height={720} loading="lazy" decoding="async" />
    {caption && <span>{caption}</span>}
  </div>;
}
