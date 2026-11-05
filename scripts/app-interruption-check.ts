import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Document-level reloads are reserved for deliberate account switches and
// explicit crash recovery. Games must recover locally without losing their host.
const allowed = new Map([
  ['AppErrorBoundary.tsx', 'Explicit user-requested fatal screen recovery'],
  ['ScreenErrorBoundary.tsx', 'Explicit Reload app buttons after a screen failure or stalled chunk load; navigation recovery stays local'],
  ['CloudSyncProvider.tsx', 'Account identity changed; isolate account storage'],
  ['Navbar.tsx', 'Explicit sign-out / guest reset'],
  ['nativeAuth.ts', 'Completed native authentication callback'],
]);

// Screen recovery must never reload from an effect, timer, promise, or render.
// Audit this exception at the call site, not merely by granting the whole file.
function isExplicitRecoveryButton(node: ts.CallExpression): boolean {
  const handler = node.parent;
  if (!ts.isArrowFunction(handler) || handler.body !== node || node.arguments.length) return false;
  const expression = handler.parent;
  if (!ts.isJsxExpression(expression)) return false;
  const attribute = expression.parent;
  if (!ts.isJsxAttribute(attribute) || attribute.name.getText() !== 'onClick') return false;
  const opening = attribute.parent.parent;
  return ts.isJsxOpeningElement(opening) && opening.tagName.getText() === 'button' &&
    opening.attributes.properties.some(property => ts.isJsxAttribute(property) &&
      property.name.getText() === 'type' && property.initializer &&
      ts.isStringLiteral(property.initializer) && property.initializer.text === 'button');
}

for (const [code, expected] of [
  ['<button type="button" onClick={()=>window.location.reload()}>Reload app</button>', true],
  ['useEffect(()=>window.location.reload(),[])', false],
  ['setTimeout(()=>window.location.reload(),12000)', false],
  ['<button type="button" onClick={window.location.reload()}>Reload app</button>', false],
  ['<button type="button" onClick={()=>setTimeout(()=>window.location.reload(),0)}>Reload app</button>', false],
] as const) {
  const fixture = ts.createSourceFile('recovery-fixture.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let guarded = false;
  const check = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(fixture) === 'window.location.reload') guarded = isExplicitRecoveryButton(node);
    ts.forEachChild(node, check);
  };
  check(fixture);
  assert.equal(guarded, expected, `Recovery reload guard: ${code}`);
}
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {encoding: 'utf8'}).split('\n').filter(path =>
  /\.(?:tsx?|jsx?)$/.test(path) && !/^(?:scripts|qa-deploy|artifacts|dist|node_modules)\//.test(path) &&
  !path.includes('/vendor/') && !path.endsWith('.bundle.js'));
const found: string[] = [];
for (const path of files) {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true,
    path.endsWith('.tsx') ? ts.ScriptKind.TSX : path.endsWith('.ts') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const property = ts.isPropertyAccessExpression(callee) ? callee.name.text :
        ts.isElementAccessExpression(callee) && ts.isStringLiteral(callee.argumentExpression) ? callee.argumentExpression.text : '';
      const target = ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee) ? callee.expression.getText(source) : '';
      const reload = property === 'reload' && /^(?:(?:window|globalThis|document)\.)?location$/.test(target);
      const historyReload = property === 'go' && /^(?:(?:window|globalThis)\.)?history$/.test(target) &&
        (!node.arguments.length || node.arguments[0].getText(source) === '0');
      if (reload || historyReload) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        found.push(`${path}:${line}`);
        assert(allowed.has(path), `Unexpected document reload at ${path}:${line}. Recover the affected screen locally, or explicitly review an intentional account/crash boundary.`);
        if (path === 'ScreenErrorBoundary.tsx') {
          assert(reload && isExplicitRecoveryButton(node), `Screen recovery reload at ${path}:${line} must be directly triggered by an explicit button click.`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
console.log(`PASS ${files.length} authored runtime files scanned; ${found.length} intentional account/crash reloads. No drill/game document reloads.`);
