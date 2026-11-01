import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Document-level reloads are reserved for deliberate account switches and
// explicit crash recovery. Games must recover locally without losing their host.
const allowed = new Map([
  ['AppErrorBoundary.tsx', 'Explicit user-requested fatal screen recovery'],
  ['CloudSyncProvider.tsx', 'Account identity changed; isolate account storage'],
  ['Navbar.tsx', 'Explicit sign-out / guest reset'],
  ['nativeAuth.ts', 'Completed native authentication callback'],
]);
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
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
console.log(`PASS ${files.length} authored runtime files scanned; ${found.length} intentional account/crash reloads. No drill/game document reloads.`);
