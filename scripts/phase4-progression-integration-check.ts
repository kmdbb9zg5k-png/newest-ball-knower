import assert from'node:assert/strict';
import{readFileSync}from'node:fs';

const migration=readFileSync(new URL('../migrations/20260831_mode_progression_receipts.sql',import.meta.url),'utf8');
const cloud=readFileSync(new URL('../progressionCloud.ts',import.meta.url),'utf8');
const owner=readFileSync(new URL('../OwnerBusinessMode.tsx',import.meta.url),'utf8');
const agent=readFileSync(new URL('../PlayerAgentMode.tsx',import.meta.url),'utf8');
const picks=readFileSync(new URL('../SportsbookHub.tsx',import.meta.url),'utf8');

assert.ok(migration.includes("'mode:'||p_event_key"),'mode receipts must use a stable server-side namespace');
assert.ok(migration.includes('ball_knower_private.apply_progress_event'),'mode rewards must use the immutable progression ledger');
for(const category of ['owner','agent','prediction'])assert.ok(migration.includes(`v_category:='${category}'`),`${category} rewards must be server-owned`);
assert.ok(cloud.includes("supabase.rpc('record_ball_knower_mode_progress'"),'the client must use the guarded progression RPC');
for(const event of ['owner_season_complete','owner_playoff_appearance','owner_conference_title','owner_championship'])assert.ok(owner.includes(`'${event}'`),`Owner Mode must publish ${event}`);
for(const event of ['agent_client_signed','agent_trade_resolved','agent_contract_signed'])assert.ok(agent.includes(`'${event}'`),`Agent Mode must publish ${event}`);
for(const event of ['prediction_correct','prediction_wrong','prediction_push'])assert.ok(picks.includes(`'${event}'`),`Picks must publish ${event}`);
assert.ok(picks.includes('`prediction:${pick.id}`'),'prediction retries must keep one idempotent key per locked pick');
console.log('Phase 4 progression integration checks passed.');
