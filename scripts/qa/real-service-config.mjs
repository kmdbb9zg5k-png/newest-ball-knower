import { randomUUID } from 'node:crypto';

export const QA_OWNER = 'ball-knower-launch-services-v1';
export const PRODUCTION_REF = 'gpnboygoosrmeydwjpvk';
export function assertLoopbackUrl(raw, protocols = ['http:']) {
  const url = new URL(raw);
  if (!protocols.includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) throw new Error('isolated_loopback_service_required');
  return url.origin;
}
export function assertLoopbackDatabase(raw) {
  const url = new URL(raw);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.pathname !== '/postgres') throw new Error('isolated_loopback_database_required');
  return raw;
}
export function readStackConfig(status) {
  const url = assertLoopbackUrl(status.API_URL);
  const databaseUrl = assertLoopbackDatabase(status.DB_URL);
  if (!status.ANON_KEY || !status.SERVICE_ROLE_KEY || status.ANON_KEY === status.SERVICE_ROLE_KEY) throw new Error('separate_public_and_admin_keys_required');
  const jwtRole = key => { try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { return null; } };
  if (!status.ANON_KEY.startsWith('sb_publishable_') && jwtRole(status.ANON_KEY) !== 'anon') throw new Error('scenario_key_must_be_public');
  if (!status.SERVICE_ROLE_KEY.startsWith('sb_secret_') && jwtRole(status.SERVICE_ROLE_KEY) !== 'service_role') throw new Error('admin_key_must_be_server_only');
  return { url, databaseUrl, publicKey: status.ANON_KEY, serviceKey: status.SERVICE_ROLE_KEY };
}
export function makeManifest(sourceCommit) {
  if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error('exact_source_commit_required');
  const runId = randomUUID();
  return {
    version: 1, owner: QA_OWNER, runId, sourceCommit,
    createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    target: 'isolated_self_hosted_supabase', leagueId: `qa-launch-${runId}`,
    users: ['a', 'b'].map(slot => ({ slot, id: randomUUID(), created: false, deleted: false })),
    phase: 'planned', cleanup: { status: 'pending' },
  };
}
export function ownsUser(user, manifest, fixture) {
  const marker = user?.app_metadata?.bk_launch_qa;
  return user?.id === fixture.id && marker?.owner === QA_OWNER && marker?.runId === manifest.runId && marker?.slot === fixture.slot && marker?.expiresAt === manifest.expiresAt;
}
