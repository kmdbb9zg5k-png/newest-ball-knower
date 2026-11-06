import { createHash } from 'node:crypto';

export const sha256 = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const identifier = value => `"${String(value).replaceAll('"', '""')}"`;
const qualified = row => `${identifier(row.schema)}.${identifier(row.name)}`;
const role = value => value === 'PUBLIC' || value === 'public' ? 'PUBLIC' : identifier(value);
const commands = { '*': 'ALL', r: 'SELECT', a: 'INSERT', w: 'UPDATE', d: 'DELETE' };
const disallowed = /(?:sb_(?:secret|publishable)_[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{8,}|-----BEGIN [^-]*PRIVATE KEY-----|https?:\/\/|(?:net\.http_|extensions\.http|http_(?:get|post)|cron\.(?:schedule|unschedule)|vault\.))/i;

export function validateSnapshot(snapshot) {
  if (snapshot.format !== 1 || !snapshot.tables?.length || !snapshot.functions?.length) throw new Error('invalid_schema_snapshot');
  if (disallowed.test(JSON.stringify({ tables: snapshot.tables, functions: snapshot.functions }))) throw new Error('schema_contains_network_or_secret_material');
  if (snapshot.tables.some(table => !['public', 'ball_knower_private', 'bk_minigames_private', 'bk_football_private'].includes(table.schema))) throw new Error('unexpected_snapshot_schema');
  if (snapshot.tables.some(table => table.columns.some(column => /nextval\(/i.test(column.default || '')))) throw new Error('serial_sequence_requires_review');
  return snapshot;
}

function grants(kind, target, acl) {
  const lines = [`revoke all on ${kind} ${target} from PUBLIC, anon, authenticated, service_role;`];
  for (const entry of acl || []) lines.push(`grant ${entry.privilege} on ${kind} ${target} to ${role(entry.grantee)}${entry.grantable ? ' with grant option' : ''};`);
  return lines;
}

export function renderSchema(snapshot) {
  validateSnapshot(snapshot);
  const lines = ['-- Generated from scoped production schema metadata; zero application rows.', 'begin;', 'set check_function_bodies = off;', "set search_path = ''; "];
  for (const schema of [...new Set(snapshot.tables.map(table => table.schema))].filter(value => value !== 'public')) {
    lines.push(`create schema if not exists ${identifier(schema)};`, `revoke all on schema ${identifier(schema)} from PUBLIC, anon, authenticated, service_role;`);
    for (const entry of snapshot.schemaAcl.filter(entry => entry.schema === schema)) lines.push(`grant ${entry.privilege} on schema ${identifier(schema)} to ${role(entry.grantee)};`);
  }
  for (const table of snapshot.tables) {
    const columns = table.columns.map(column => {
      let text = `${identifier(column.name)} ${column.type}`;
      if (column.identity) text += ` generated ${column.identity === 'a' ? 'always' : 'by default'} as identity`;
      else if (column.generated) text += ` generated always as (${column.default}) stored`;
      else if (column.default !== null) text += ` default ${column.default}`;
      if (column.notNull) text += ' not null';
      return text;
    });
    lines.push(`create table ${qualified(table)} (\n  ${columns.join(',\n  ')}\n);`);
    if (table.rls) lines.push(`alter table ${qualified(table)} enable row level security;`);
    if (table.forceRls) lines.push(`alter table ${qualified(table)} force row level security;`);
  }
  // pg_get_functiondef returns a complete CREATE statement without its SQL
  // terminator. Each definition must terminate before the next CREATE.
  for (const fn of snapshot.functions) lines.push(`${fn.definition.trimEnd()};`);
  for (const foreign of [false, true]) for (const table of snapshot.tables) for (const constraint of table.constraints || []) {
    if ((constraint.kind === 'f') === foreign) lines.push(`alter table ${qualified(table)} add constraint ${identifier(constraint.name)} ${constraint.definition};`);
  }
  for (const table of snapshot.tables) {
    for (const index of table.indexes || []) lines.push(`${index};`);
    for (const trigger of table.triggers || []) {
      lines.push(`${trigger.definition};`);
      if (trigger.enabled !== 'O') lines.push(`alter table ${qualified(table)} ${trigger.enabled === 'D' ? 'disable' : trigger.enabled === 'A' ? 'enable always' : 'enable replica'} trigger ${identifier(trigger.name)};`);
    }
    for (const policy of table.policies || []) {
      if (!commands[policy.command]) throw new Error('unknown_policy_command');
      lines.push(`create policy ${identifier(policy.name)} on ${qualified(table)} as ${policy.permissive ? 'permissive' : 'restrictive'} for ${commands[policy.command]} to ${policy.roles.map(role).join(', ')}${policy.using ? ` using (${policy.using})` : ''}${policy.check ? ` with check (${policy.check})` : ''};`);
    }
    lines.push(...grants('table', qualified(table), table.acl));
  }
  for (const fn of snapshot.functions) lines.push(...grants('function', `${qualified(fn)}(${fn.arguments})`, fn.acl));
  for (const item of snapshot.realtime || []) if (snapshot.tables.some(table => table.schema === item.schema && table.name === item.table)) lines.push(`alter publication supabase_realtime add table ${identifier(item.schema)}.${identifier(item.table)};`);
  lines.push("notify pgrst, 'reload schema';", 'commit;');
  return lines.join('\n') + '\n';
}

export function compareSchema(expected, actual) {
  const differences = [];
  const sorted = values => (values || []).map(value => structuredClone(value)).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const canonical = (object, kind) => {
    const value = structuredClone(object);
    value.acl = sorted(value.acl);
    if (kind === 'tables') {
      for (const field of ['constraints', 'indexes', 'triggers']) value[field] = sorted(value[field]);
      value.policies = sorted((value.policies || []).map(policy => ({ ...policy, roles: [...policy.roles].sort() })));
    }
    return value;
  };
  for (const kind of ['tables', 'functions']) for (const object of expected[kind]) {
    const key = row => `${row.schema}.${row.name}${kind === 'functions' ? `(${row.arguments})` : ''}`;
    const counterpart = actual[kind]?.find(row => key(row) === key(object));
    if (!counterpart || sha256(canonical(object, kind)) !== sha256(canonical(counterpart, kind))) differences.push(key(object));
  }
  const schemas = new Set(expected.tables.map(table => table.schema));
  if (sha256(sorted(expected.schemaAcl.filter(entry => schemas.has(entry.schema)))) !== sha256(sorted(actual.schemaAcl?.filter(entry => schemas.has(entry.schema))))) differences.push('scoped_schema_grants');
  const tables = new Set(expected.tables.map(table => `${table.schema}.${table.name}`));
  const realtime = values => sorted(values?.filter(entry => tables.has(`${entry.schema}.${entry.table}`)));
  if (sha256(realtime(expected.realtime)) !== sha256(realtime(actual.realtime))) differences.push('scoped_realtime_publication');
  return { matched: differences.length === 0, expectedTables: expected.tables.length, expectedFunctions: expected.functions.length, differences, snapshotSha256: sha256(expected) };
}
