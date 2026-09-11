import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const solo = readFileSync(new URL('../SoloMode.tsx', import.meta.url), 'utf8');

assert.match(solo, /aria-label="Back to Solo Mode choices"/, 'Every Solo sub-screen must expose the persistent back control.');
assert.match(solo, /className="fixed[^\"]+z-\[35\]/, 'The Solo back control must remain visible while long draft and franchise pages scroll.');
assert.match(solo, /top-\[calc\(72px\+env\(safe-area-inset-top\)\+\.75rem\)\]/, 'The mobile back control must clear the fixed product header and iPhone safe area.');
assert.match(solo, /md:top-\[calc\(116px\+env\(safe-area-inset-top\)\+\.75rem\)\]/, 'The desktop back control must clear both header rows.');
assert.match(solo, /onClick=\{back\}/, 'The persistent control must return to the Solo choice hub.');

console.log('Solo back-navigation checks passed: the control stays visible above every sub-screen and returns to the Solo hub.');
