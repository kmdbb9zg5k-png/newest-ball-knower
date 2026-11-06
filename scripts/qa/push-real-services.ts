import assert from 'node:assert/strict';
import { createECDH, randomBytes, randomUUID } from 'node:crypto';
import { createServer, request } from 'node:http';
import { createPushHandler } from '../../api/push';
import { localSql } from './bootstrap-real-services';

const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
const requireOk = (response: any) => { if (response.error) throw response.error; return response.data; };

async function listenPushHandler(handler: any) {
  const server = createServer(async (req, res) => {
    try {
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 16_000) throw new Error('fixture_request_too_large'); chunks.push(chunk); }
      const url = new URL(req.url || '/', 'http://127.0.0.1');
      if (url.pathname !== '/api/push') { res.writeHead(404).end(); return; }
      const input = Object.assign(req, { query: Object.fromEntries(url.searchParams), body: chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined });
      const output = Object.assign(res, {
        status(value: number) { res.statusCode = value; return output; },
        json(value: any) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); return output; },
      });
      await handler(input, output);
    } catch { if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' }); res.end('{"error":"isolated_fixture_handler_failed"}'); }
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  assert.ok(address && typeof address === 'object' && address.address === '127.0.0.1');
  return { port: address.port, close: () => new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }) };
}

// Real HTTP to a worker bound only to an ephemeral loopback port. The actual
// API handler verifies JWTs and calls actual GoTrue/PostgREST; no responses are
// mocked and no provider delivery sender is ever invoked.
async function invoke(boundary: { port: number }, token: string | null, method: string, query: Record<string, string>, body?: any) {
  return new Promise<{ status: number; payload: any }>((resolve, reject) => {
    const data = body === undefined ? undefined : JSON.stringify(body);
    const call = request({ hostname: '127.0.0.1', port: boundary.port, path: '/api/push?' + new URLSearchParams(query), method, agent: false, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), Connection: 'close' } }, response => {
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(chunk));
      response.once('error', reject);
      response.once('end', () => { try { resolve({ status: response.statusCode || 0, payload: JSON.parse(Buffer.concat(chunks).toString('utf8')) }); } catch { reject(new Error('invalid_fixture_http_json')); } });
    });
    call.setTimeout(25_000, () => call.destroy(new Error('isolated_push_api_timeout')));
    call.once('error', reject); call.end(data);
  });
}

export async function verifyRealPushSessions({ admin, fixture, leagueId, databaseUrl, runId }: any) {
  const vapid = createECDH('prime256v1'); vapid.generateKeys();
  const subscriptionKey = createECDH('prime256v1'); subscriptionKey.generateKeys();
  const configuration = { web: { subject: 'mailto:launch-qa@example.invalid', publicKey: vapid.getPublicKey().toString('base64url'), privateKey: vapid.getPrivateKey().toString('base64url') } };
  const handler = await listenPushHandler(createPushHandler({ database: admin, configuration: () => configuration }));
  try {
    const registrations: any[] = fixture.map((person: any, index: number) => ({
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
      const installation = registrations[index];
      const fence = await invoke(handler, token, 'POST', {}, { action: 'installation', installationId: installation.installationId, installationSecret: installation.installationSecret });
      assert.equal(fence.status, 200); assert.deepEqual(fence.payload, { epoch: null, revision: 0 });
      Object.assign(installation, { intentRevision: 1, intentId: randomUUID(), expectedEpoch: fence.payload.epoch });
      const registered = await invoke(handler, token, 'POST', {}, installation);
      assert.equal(registered.status, 200); assert.match(registered.payload.id, /^[a-f0-9-]{36}$/);
      installation.expectedEpoch = registered.payload.epoch;
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

    const originalToken = a.tokens[0];
    const second = requireOk(await a.app.supabase.auth.signInWithPassword({ email: a.email, password: a.password })).session;
    assert.notEqual(second.access_token, originalToken); a.tokens.push(second.access_token);
    const oldDisable = { action: 'unsubscribe', installationId: registrations[0].installationId, installationSecret: registrations[0].installationSecret, intentRevision: 2, intentId: randomUUID(), expectedEpoch: registrations[0].expectedEpoch };
    Object.assign(registrations[0], { intentRevision: 3, intentId: randomUUID() });
    assert.equal((await invoke(handler, second.access_token, 'POST', {}, registrations[0])).status, 200);
    const lateDisable = await invoke(handler, originalToken, 'POST', {}, oldDisable);
    assert.equal(lateDisable.status, 409); assert.equal(lateDisable.payload.code, 'push_state_changed');
    assert.equal(Number(localSql(databaseUrl, `select count(*) from ball_knower_private.push_devices where id=${literal(deviceIds[0])}::uuid and revoked_at is null;`)), 1);

    const capturedEnable = { ...registrations[0], intentRevision: 4, intentId: randomUUID() };
    assert.equal((await invoke(handler, second.access_token, 'POST', {}, { action: 'revoke-device', deviceId: deviceIds[0] })).status, 200);
    const staleEpoch = await invoke(handler, second.access_token, 'POST', {}, capturedEnable);
    assert.equal(staleEpoch.status, 409); assert.equal(staleEpoch.payload.code, 'push_state_changed');
    const oldRestore = await invoke(handler, second.access_token, 'POST', {}, { ...registrations[0], restore: true });
    assert.equal(oldRestore.status, 409); assert.equal(oldRestore.payload.code, 'push_reenable_required');
    const freshFence = await invoke(handler, second.access_token, 'POST', {}, { action: 'installation', installationId: registrations[0].installationId, installationSecret: registrations[0].installationSecret });
    assert.equal(freshFence.status, 200); assert.deepEqual(Object.keys(freshFence.payload).sort(), ['epoch', 'revision']);
    assert.notEqual(freshFence.payload.epoch, capturedEnable.expectedEpoch);
    Object.assign(registrations[0], { intentRevision: freshFence.payload.revision + 1, intentId: randomUUID(), expectedEpoch: freshFence.payload.epoch });
    assert.equal((await invoke(handler, second.access_token, 'POST', {}, registrations[0])).status, 200);
    assert.equal((await invoke(handler, second.access_token, 'POST', {}, { ...registrations[0], restore: true })).status, 200);

    const neverEnabled = { ...registrations[0], installationId: randomUUID(), installationSecret: randomBytes(32).toString('base64url'), intentRevision: 1, intentId: randomUUID(), expectedEpoch: null, subscription: { ...registrations[0].subscription, endpoint: registrations[0].subscription.endpoint + '_tombstone' } };
    const firstDisable = { action: 'unsubscribe', installationId: neverEnabled.installationId, installationSecret: neverEnabled.installationSecret, intentRevision: 2, intentId: randomUUID(), expectedEpoch: null };
    assert.equal((await invoke(handler, second.access_token, 'POST', {}, firstDisable)).status, 200);
    const olderFirstEnable = await invoke(handler, originalToken, 'POST', {}, neverEnabled);
    assert.equal(olderFirstEnable.status, 409); assert.equal(olderFirstEnable.payload.code, 'push_state_changed');
    assert.equal(Number(localSql(databaseUrl, `select count(*) from ball_knower_private.push_devices where installation_id=${literal(neverEnabled.installationId)}::uuid;`)), 0);

    // Exercise quiet-hour settings above, then make this queue authorization
    // fixture independent of the wall clock. Quiet deferral is covered by the
    // separate SQL behavioral fixture, not inferred from a daytime CI run.
    const deliverySettings = await invoke(handler, second.access_token, 'POST', {}, { action: 'settings', quietEnabled: false, timeZone: 'America/New_York', startMinute: 1320, endMinute: 420 });
    assert.equal(deliverySettings.status, 200); assert.equal(deliverySettings.payload.quietEnabled, false);
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

    assert.equal(Number(localSql(databaseUrl, `select count(*) from auth.sessions where user_id=${literal(a.item.id)}::uuid;`)), 2);
    // Deliberately skip installation unsubscribe: the Auth session FK must still
    // delete both the device and its queued delivery after global sign-out.
    requireOk(await admin.auth.admin.signOut(second.access_token, 'global'));
    a.sessionsGloballyRevoked = true;
    const after = JSON.parse(localSql(databaseUrl, `select json_build_object(
      'sessions',(select count(*) from auth.sessions where user_id=${literal(a.item.id)}::uuid),
      'intents',(select count(*) from ball_knower_private.push_installation_intents where auth_user_id=${literal(a.item.id)}::uuid),
      'devices',(select count(*) from ball_knower_private.push_devices where auth_user_id=${literal(a.item.id)}::uuid),
      'deliveries',(select count(*) from ball_knower_private.push_deliveries where auth_user_id=${literal(a.item.id)}::uuid));`));
    assert.deepEqual(after, { sessions: 0, intents: 0, devices: 0, deliveries: 0 });
    const stale = requireOk(await admin.rpc('prepare_ball_knower_push', { p_id: claims[0].id, p_claim: claims[0].claim_token }));
    assert.equal(stale.state, 'stale');
    const revokedRpc = await admin.rpc('manage_ball_knower_push', { p_owner: a.item.id, p_action: 'settings', p_data: { sessionId: sessionIds[0] } });
    assert.equal(revokedRpc.error?.code, '28000');
    let rejectedApiRequests = 0;
    for (const token of a.tokens) {
      const attempts: Array<[string, Record<string, string>, any?]> = [
        ['POST', {}, registrations[0]],
        ['POST', {}, { action: 'installation', installationId: registrations[0].installationId, installationSecret: registrations[0].installationSecret }],
        ['GET', { resource: 'settings' }],
        ['GET', { resource: 'devices' }],
        ['POST', {}, { action: 'settings', quietEnabled: false, timeZone: 'UTC', startMinute: 1320, endMinute: 420 }],
        ['POST', {}, { action: 'revoke-device', deviceId: deviceIds[0] }],
        ['GET', { resource: 'notification', id: notificationId }],
        ['POST', {}, { action: 'unsubscribe', installationId: registrations[0].installationId, installationSecret: registrations[0].installationSecret, intentRevision: registrations[0].intentRevision + 1, intentId: randomUUID(), expectedEpoch: registrations[0].expectedEpoch }],
      ];
      for (const [method, query, body] of attempts) {
        assert.equal((await invoke(handler, token, method, query, body)).status, 401); rejectedApiRequests++;
      }
    }
    assert.equal((await invoke(handler, b.tokens.at(-1), 'GET', { resource: 'settings' })).status, 200);
    assert.equal(Number(localSql(databaseUrl, `select count(*) from ball_knower_private.push_devices where id=${literal(deviceIds[1])}::uuid and auth_user_id=${literal(b.item.id)}::uuid and revoked_at is null;`)), 1);
    return { activeSessionsBeforeGlobalSignOut: 3, apiExecution: 'actual_HTTP_handler_with_real_GoTrue_and_PostgREST', serviceRpcDeniedToAuthenticated: true, crossAccountDeviceUnaffected: true, lateDisableCannotUndoNewerEnable: true, revokedEpochRejectsCapturedHigherRevision: true, restoreCannotUndoRemoteRevoke: true, disabledFirstSubscriptionTombstoneRejectsOlderEnable: true, ownNotificationDestinationAuthorized: true, otherAccountNotificationDenied: true, preparedSyntheticQueueRows: 1, globalSignOutSessionsRemoved: 2, intentDeviceAndQueueCascadedWithoutUnsubscribe: true, staleQueueClaimRejected: true, revokedSessionDatabaseRpcRejected: true, rejectedApiRequests, otherAccountSessionStillWorks: true, providerSends: 0, providerAcceptanceVerified: false, physicalDeliveryVerified: false };
  } finally { await handler.close(); }
}
