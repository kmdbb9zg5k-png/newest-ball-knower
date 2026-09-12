import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {Player} from '../types';
import {compareMobileDraftPlayers} from '../MobileDraftRoom';

const player=(id:string,name:string,salary:number,ovr:number)=>({id,name,salary,ovr} as Player);
const players=[
  player('z','Zed Player',10,99),
  player('a','Alpha Player',10,60),
  player('m','Middle Player',12,70),
];

assert.deepEqual([...players].sort(compareMobileDraftPlayers('salary_desc')).map(item=>item.id),['m','a','z']);
assert.deepEqual([...players].sort(compareMobileDraftPlayers('salary_asc')).map(item=>item.id),['a','z','m']);

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const mobile=read('MobileDraftRoom.tsx');
const styles=read('index.css');
const migration=read('migrations/20260912150000_separate_draft_order_game_roster_size.sql');

assert.ok(mobile.includes("useState<MobileDraftSort>('salary_desc')"),'mobile Draft Order Game must open sorted by salary');
assert.ok(mobile.includes('aria-label="Back to league lobby"')&&mobile.includes('bk-draft-order-game-header'),'the back action must remain inside the pinned draft header');
assert.ok(styles.includes('.bk-live-draft-viewport .bk-draft-order-game-header')&&styles.includes('z-index: 100 !important'),'the draft header and global tab bar must stay anchored to separate viewport layers');
assert.ok(migration.includes("='game'")&&migration.includes('then 20')&&migration.includes("nullif(l.settings->>'rosterSize','')::integer"),'Draft Order Game must keep 20 players without changing standard fantasy roster sizes');

console.log('Draft Order Game regression checks passed: salary sorting, visible back navigation, fixed layers, and 20-player submission.');
