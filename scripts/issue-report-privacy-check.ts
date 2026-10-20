import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { redactDiagnostic } from '../issueReporting';
import handler from '../api/report-issue';

const cases = [
  [JSON.stringify({password: 'synthetic \"quoted\" password'}), 'quoted'],
  ['Bearer synthetic-bearer-token', 'synthetic-bearer-token'],
  ['Authorization: Bearer synthetic-auth-token', 'synthetic-auth-token'],
  ['{"access_token":"synthetic-access-token"}', 'synthetic-access-token'],
  ['{"password":"synthetic password with spaces"}', 'synthetic password with spaces'],
  ["{'api_key':'synthetic-api-key'}", 'synthetic-api-key'],
  ['https://example.test/?refresh_token=synthetic-refresh&screen=home', 'synthetic-refresh'],
  ['secret=synthetic-secret', 'synthetic-secret'],
  ['a'.repeat(28)+'.'+'b'.repeat(28)+'.'+'c'.repeat(24), 'b'.repeat(28)],
];
for (const [input, secret] of cases) {
  assert(!redactDiagnostic(input).includes(secret), input);
}
assert.equal(redactDiagnostic('Draft failed at round 3'), 'Draft failed at round 3');
assert(redactDiagnostic(cases.find(([v]) => v.startsWith('https://'))![0]).includes('&screen=home'));
assert.equal(redactDiagnostic('x'.repeat(7000)).length, 6000);

// Exercise the actual API with a mocked mail provider: no email is sent.
const originalFetch = globalThis.fetch;
const originalKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.ERROR_REPORT_FROM_EMAIL;
process.env.RESEND_API_KEY = 'synthetic-provider-key';
process.env.ERROR_REPORT_FROM_EMAIL = 'test@example.invalid';
let mail = '';
globalThis.fetch = (async (_url, init) => {
  mail = String(init?.body);
  return new Response('{}', {status: 200});
}) as typeof fetch;
try {
  const req = Readable.from([JSON.stringify({id: 'test', message: cases.map(([v]) => v).join('\n')})]);
  Object.assign(req, {method:'POST', headers:{host:'example.test', origin:'https://example.test'}, socket:{remoteAddress:'privacy-test'}});
  let status = 0;
  const res = {setHeader(){}, status(code:number){status=code; return this;}, json(body:unknown){return body;}};
  await handler(req, res);
  assert.equal(status, 200);
  for (const [,secret] of cases) assert(!mail.includes(secret), secret);
  assert(mail.includes('REDACTED'));
} finally {
  globalThis.fetch = originalFetch;
  if(originalKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY=originalKey;
  if(originalFrom === undefined) delete process.env.ERROR_REPORT_FROM_EMAIL; else process.env.ERROR_REPORT_FROM_EMAIL=originalFrom;
}
console.log('PASS diagnostic privacy: browser + actual API, bearer/JSON/query/JWT redaction, readable messages and length limits; mail mocked.');
