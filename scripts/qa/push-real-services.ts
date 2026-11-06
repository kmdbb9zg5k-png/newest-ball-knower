import assert from 'node:assert/strict';
import { createECDH, randomBytes, randomUUID } from 'node:crypto';
import { createPushHandler } from '../../api/push';
import { localSql } from './bootstrap-real-services';

const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const requireOk = (response: any) => { if (response.error) throw response.error; return response.data; };

// Calls the actual request handler in process. Its JWT verification and every
// database RPC use real GoTrue/PostgREST. No response or transport is replaced.
async function invoke(handler: any, token: string | null, method: string, query: Record<string, string>, body?: any) {
  let status = 200, payload: any;
  const response = {
    setHeader() {},
    status(value: number) { status = value; return this; },
    json(value: any) { payload = value; return this; },
  };
  await handler({ method, headers: token ? { authorization: `Bearer ${token}` } : {}, query, body }, response);
  return { status, payload };
}

export async function verifyRealPushSessions({ admin, fixture, leagueId, databaseUrl, runId }: any) {
  const vapid = createECDH('prime256v1'); vapid.generateKeys();
  const subscriptionKey = createECDH('prime256v1'); subscriptionKey.generateKeys();
  const configuration = { web: { subject: 'mailto:launch-qa@example.invalid', publicKey: vapid.getPublicKey().toString('base64url'), privateKey: vapid.getPrivateKey().toString('base64url') } };
  const handler = createPushHandler({ database: admin, configuration: () => configuration });
  const registrations = fixture.map((person: any, index: number) => ({
    action: 'subscribe', installationId: randomUUID(), installationSecret: randomBytes(32).toString('base64url'),
    transport: 'web', label: `QA ${runId.slice(0, 8)} ${index}`,
    subscription: { endpoint: `https://fcm.googleapis.com/fcm/send/bk_launch_qa_${runId}_${index}`, keys: { p256dh: subscriptionKey.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') } },
  }));
  const deviceIds: string[] = [];
  const sessionIds: string[] = [];
  for (let index = 0; index < fixture.length; index++) {
    const person = fixture[index], token = person.tokens.at(-1);
    assert.equal(requireOk(await admin.auth.getUser(token)).user.id, person.item.id);
    // Decode claims only after the real Auth service verified this exact JWT.
    sessionIds.push(JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).session_id);
    const registered = await invoke(handler, token, 'POST', {}, registrations[index]);
    assert.equal(registered.status, 200); assert.match(registered.payload.id, /^[a-f0-9-]{36}$/);
    deviceIds.push(registered.payload.id);
    const settings = { action: 'settings', quietEnabled: true, timeZone: 'America/New_York', startMinute: 1320, endMinute: 420 };
    const saved = await invoke(handler, token, 'POST', {}, settings);
    assert.equal(saved.status, 200); assert.equal(saved.payload.timeZone, settings.timeZone);
    const direct = await person.app.supabase.rpc('manage_ball_knower_push', { p_owner: person.item.id, p_action: 'settings', p_data: { sessionId: sessionIds[index] } });
    assert.equal(direct.error?.code, '42501', 'actual authenticated sessions cannot call the service-only RPC');
  }
  assert.equal((await invoke(handler, null, 'GET', { resource: 'settings' })).status, 401);
  const [a, b] = fixture;
  const crossAccount = await invoke(handler, b.tokens.at(-1), 'POST', {}, { action: 'revoke-device', deviceId: deviceIds[0] });
  assert.equal(crossAccount.status, 200);
  assert.equal(Number(localSql(databaseUrl, `select count(*) from ball_knower_private.push_devices where id=${literal(deviceIds[0])}::uuid and auth_user_id=${literal(a.item.id)}::uuid and revoked_at is null;`)), 1);

  const notificationId = randomUUID();
  requireOk(await a.app.supabase.from('ball_knower_notifications').insert({ id: notificationId, league_id: leagueId, auth_user_id: a.item.id, title: `QA ${runId}`, body: 'Synthetic isolated queue fixture', kind: 'roster_submitted', category: 'roster', push_eligible: true }));
  const destination = await invoke(handler, a.tokens.at(-1), 'GET', { resource: 'notification', id: notificationId });
  assert.equal(destination.status, 200); assert.equal(destination.payload.leagueId, leagueId); assert.equal(destination.payload.destination, 'roster');
  assert.equal((await invoke(handler, b.tokens.at(-1), 'GET', { resource: 'notification', id: notificationId })).status, 404);
  const claims = requireOk(await admin.rpc('claim_ball_knower_push', { p_limit: 12, p_transports: ['web'] }));
  assert.equal(claims.length, 1, 'only the isolated labelled notification is queued');
  const ready = requireOk(await admin.rpc('prepare_ball_knower_push', { p_id: claims[0].id, p_claim: claims[0].claim_token }));
  assert.equal(ready.state, 'ready'); assert.equal(ready.payload.notificationId, notificationId);
  // Do not invoke a delivery handler or a sender. This fixture proves queue
  // authorization, while actual provider/device acceptance remains untested.

  const second = requireOk(await a.app.supabase.auth.signInWithPassword({ email: a.email, password: a.password })).session;
  assert.notEqual(second.access_token, a.tokens[0]); a.tokens.push(second.access_token);
  assert.equal(Number(localSql(databaseUrl, `select count(*) from auth.sessions where user_id=${literal(a.item.id)}::uuid;`)), 2);
  // Deliberately skip installation unsubscribe: the Auth session FK must still
  // delete both the device and its queued delivery after global sign-out.
  requireOk(await admin.auth.admin.signOut(second.access_token, 'global'));
  a.sessionsGloballyRevoked = true;
  const after = JSON.parse(localSql(databaseUrl, `select json_build_object(
    'sessions',(select count(*) from auth.sessions where user_id=${literal(a.item.id)}::uuid),
    'devices',(select count(*) from ball_knower_private.push_devices where auth_user_id=${literal(a.item.id)}::uuid),
    'deliveries',(select count(*) from ball_knower_private.push_deliveries where auth_user_id=${literal(a.item.id)}::uuid));`));
  assert.deepEqual(after, { sessions: 0, devices: 0, deliveries: 0 });
  const stale = requireOk(await admin.rpc('prepare_ball_knower_push', { p_id: claims[0].id, p_claim: claims[0].claim_token }));
  assert.equal(stale.state, 'stale');
  const revokedRpc = await admin.rpc('manage_ball_knower_push', { p_owner: a.item.id, p_action: 'settings', p_data: { sessionId: sessionIds[0] } });
  assert.equal(revokedRpc.error?.code, '28000');
  let rejectedApiRequests = 0;
  for (const token of a.tokens) {
    const attempts: Array<[string, Record<string, string>, any?]> = [
      ['POST', {}, registrations[0]],
      ['GET', { resource: 'settings' }],
      ['GET', { resource: 'devices' }],
      ['POST', {}, { action: 'settings', quietEnabled: false, timeZone: 'UTC', startMinute: 1320, endMinute: 420 }],
      ['POST', {}, { action: 'revoke-device', deviceId: deviceIds[0] }],
      ['GET', { resource: 'notification', id: notificationId }],
      ['POST', {}, { action: 'unsubscribe', installationId: registrations[0].installationId, installationSecret: registrations[0].installationSecret }],
    ];
    for (const [method, query, body] of attempts) {
      assert.equal((await invoke(handler, token, method, query, body)).status, 401); rejectedApiRequests++;
    }
  }
  assert.equal((await invoke(handler, b.tokens.at(-1), 'GET', { resource: 'settings' })).status, 200);
  assert.equal(Number(localSql(databaseUrl, `select count(*) from ball_knower_private.push_devices where id=${literal(deviceIds[1])}::uuid and auth_user_id=${literal(b.item.id)}::uuid and revoked_at is null;`)), 1);
  return { activeSessionsBeforeGlobalSignOut: 3, apiExecution: 'actual_handler_in_process_with_real_GoTrue_and_PostgREST', serviceRpcDeniedToAuthenticated: true, crossAccountDeviceUnaffected: true, ownNotificationDestinationAuthorized: true, otherAccountNotificationDenied: true, preparedSyntheticQueueRows: 1, globalSignOutSessionsRemoved: 2, deviceAndQueueCascadedWithoutUnsubscribe: true, staleQueueClaimRejected: true, revokedSessionDatabaseRpcRejected: true, rejectedApiRequests, otherAccountSessionStillWorks: true, providerSends: 0, providerAcceptanceVerified: false, physicalDeliveryVerified: false };
}
