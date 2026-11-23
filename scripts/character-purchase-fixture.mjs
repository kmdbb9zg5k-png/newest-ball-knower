import assert from 'node:assert/strict';

export async function mockCharacterPurchases(context, purchases, codeGrant = [], equipped) {
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    aud: 'authenticated', role: 'authenticated', email: 'character-fixture@example.invalid',
    is_anonymous: false, app_metadata: { provider: 'email' }, user_metadata: equipped ? { bk_game_athlete: equipped } : {},
  };
  const expires_at = Math.floor(Date.now() / 1000) + 86400;
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const access_token = [encode({ alg: 'HS256', typ: 'JWT' }),
    encode({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: expires_at }),
    'test-fixture-only'].join('.');
  // Seed a pre-equip session. The auth user endpoint has the newest selection.
  const session = { user: { ...user, user_metadata: {} }, access_token, refresh_token: 'fixture-only', token_type: 'bearer', expires_at };
  let redeemed = false;

  await context.addInitScript(value => {
    const key = 'sb-gpnboygoosrmeydwjpvk-auth-token';
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
  }, session);
  await context.route('**/*.supabase.co/**', async route => {
    const { pathname, searchParams } = new URL(route.request().url());
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': '*',
    };
    const respond = json => route.fulfill({ json, headers });
    if (route.request().method() === 'OPTIONS') return respond({});
    if (pathname === '/auth/v1/user') {
      if (route.request().method() === 'PUT') Object.assign(user.user_metadata, route.request().postDataJSON()?.data);
      return respond(user);
    }
    if (pathname === '/rest/v1/rpc/bk_store_character_code') {
      const { p_code } = route.request().postDataJSON() || {};
      if (p_code && p_code !== 'FIXTURE-CODE') return respond([]);
      assert.equal(route.request().headers().authorization, 'Bearer ' + access_token);
      if (p_code) redeemed = true;
      return respond(redeemed ? codeGrant : []);
    }
    if (pathname === '/rest/v1/ball_knower_entitlements' && searchParams.has('source')) {
      assert.equal(searchParams.get('auth_user_id'), 'eq.' + user.id);
      assert.equal(searchParams.get('source'), 'eq.purchase');
      assert.equal(route.request().headers().authorization, 'Bearer ' + access_token);
      return respond(purchases);
    }
    return respond([]);
  });
  return selection => { user.user_metadata.bk_game_athlete = selection; };
}
