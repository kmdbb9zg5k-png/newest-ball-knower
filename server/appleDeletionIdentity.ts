import { constants, createHash, createPublicKey, verify, type JsonWebKey } from 'node:crypto';

type AppleIdentityContext = { clientId: string; nonce: string; subject: string; linkedSubjects: string[] };

/** Apple currently advertises RS256 only in its OpenID discovery document. */
export async function verifyAppleDeletionIdentity(token: string, context: AppleIdentityContext, signal: AbortSignal): Promise<void> {
  const parts = token.split('.');
  if (parts.length !== 3 || token.length > 16_384 || !parts.every(part => /^[A-Za-z0-9_-]+$/.test(part))) throw new Error('Invalid Apple identity token.');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.crit !== undefined) throw new Error('Unsupported Apple signature.');
  const response = await fetch('https://appleid.apple.com/auth/keys', { signal });
  if (!response.ok) throw new Error('Apple verification is unavailable.');
  const jwks = await response.json() as { keys?: Array<JsonWebKey & { kid?: string; alg?: string; use?: string }> };
  // Fetch current keys for each deletion: rotation never depends on a stale
  // process cache, and a token can never choose its own key URL or algorithm.
  const jwk = jwks.keys?.find(key => key.kid === header.kid && key.alg === 'RS256' && key.kty === 'RSA' && key.use === 'sig');
  if (!jwk || !verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), {
    key: createPublicKey({ key: jwk, format: 'jwk' }), padding: constants.RSA_PKCS1_PADDING,
  }, Buffer.from(parts[2], 'base64url'))) throw new Error('Invalid Apple signature.');
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  const now = Math.floor(Date.now() / 1000);
  const nonce = createHash('sha256').update(context.nonce).digest('hex');
  if (claims.iss !== 'https://appleid.apple.com' || claims.aud !== context.clientId ||
      typeof claims.exp !== 'number' || claims.exp <= now ||
      typeof claims.iat !== 'number' || claims.iat > now + 60 || claims.iat < now - 600 ||
      claims.nonce !== nonce || claims.sub !== context.subject || !context.linkedSubjects.includes(claims.sub)) {
    throw new Error('Apple authorization does not match this account.');
  }
}
