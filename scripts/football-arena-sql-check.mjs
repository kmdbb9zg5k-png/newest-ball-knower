// Isolated PostgreSQL engine; no remote connection. Community prerequisites are
// minimal fixtures here; the arena migrations and integration SQL run unchanged.
import {readFile} from 'node:fs/promises';
const {PGlite}=await import(process.env.BK_PGLITE_MODULE||'@electric-sql/pglite');
const db=new PGlite();
try{
 await db.exec(`create role anon;create role authenticated;
 create schema auth;create table auth.users(id uuid primary key,aud text,role text,email text,is_anonymous boolean,raw_app_meta_data jsonb,raw_user_meta_data jsonb);
 create table public.ball_knower_progress_profiles(user_id uuid primary key,display_name text);
 create table public.ball_knower_friendships(requester_id uuid,recipient_id uuid,status text);
 create table public.ball_knower_user_blocks(blocker_id uuid,blocked_id uuid);
 create schema ball_knower_private;create schema bk_minigames_private;
 create function ball_knower_private.require_permanent_community_user() returns uuid language plpgsql security definer as $$
 declare me uuid:=current_setting('request.jwt.claim.sub',true)::uuid;
 begin if not exists(select 1 from auth.users where id=me and not is_anonymous) then raise exception 'Permanent account required';end if;return me;end $$;
 create function bk_minigames_private.available(id uuid) returns boolean language sql security definer as $$ select exists(select 1 from auth.users where users.id=$1 and not is_anonymous) $$;`);
 for(const file of ['supabase/migrations/20261031043651_football_three_drive_arena.sql','supabase/migrations/20261101055949_football_arena_matchmaking_stats.sql','scripts/football-arena-integration.sql'])await db.exec(await readFile(file,'utf8'));
 console.log('PASS: isolated arena PostgreSQL integration, detail validation, legacy results, kickoff TD, quick matchmaking, immutable retry, privacy and grants.');
}finally{await db.close();}
