import assert from 'node:assert/strict';

export async function mockCharacterPurchases(context, purchases) {
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    aud: 'authenticated', role: 'authenticated', email: 'character-fixture@example.invalid',
    is_anonymous: false, app_metadata: { provider: 'email' }, user_metadata: {},
  };
  const expires_at = Math.floor(Date.now() / 1000) + 86400;
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const access_token = [encode({ alg: 'HS256', typ: 'JWT' }),
    encode({ sub: user.id, aud: 'authenticated', role: 'authenticated', exp: expires_at }),
    'test-fixture-only'].join('.');
  const session = { user, access_token, refresh_token: 'fixture-only', token_type: 'bearer', expires_at };

  await context.addInitScript(value => {
    localStorage.setItem('sb-gpnboygoosrmeydwjpvk-auth-token', JSON.stringify(value));
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
    if (pathname === '/auth/v1/user') return respond(user);
    if (pathname === '/rest/v1/ball_knower_entitlements' && searchParams.has('source')) {
      assert.equal(searchParams.get('auth_user_id'), 'eq.' + user.id);
      assert.equal(searchParams.get('source'), 'eq.purchase');
      assert.equal(route.request().headers().authorization, 'Bearer ' + access_token);
      return respond(purchases);
    }
    return respond([]);
  });
}
