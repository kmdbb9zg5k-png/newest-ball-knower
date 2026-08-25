-- Atomic trade proposals and a complete commissioner-controlled next-season reset.
create or replace function public.propose_ball_knower_trade(
  p_league_id text,p_recipient_member_id text,p_offered_player_ids jsonb,p_requested_player_ids jsonb,p_note text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_auth uuid:=auth.uid();v_proposer public.ball_knower_league_members%rowtype;v_recipient public.ball_knower_league_members%rowtype;v_id uuid;v_player text;
begin
 if v_auth is null then raise exception 'Authentication required';end if;
 select * into v_proposer from public.ball_knower_league_members where league_id=p_league_id and auth_user_id=v_auth limit 1;
 if not found then raise exception 'League membership not found';end if;
 select * into v_recipient from public.ball_knower_league_members where league_id=p_league_id and id=p_recipient_member_id;
 if not found or v_recipient.id=v_proposer.id then raise exception 'Choose another team in this league';end if;
 if jsonb_typeof(p_offered_player_ids)<>'array' or jsonb_typeof(p_requested_player_ids)<>'array' then raise exception 'Trade players must be arrays';end if;
 if jsonb_array_length(p_offered_player_ids)<1 or jsonb_array_length(p_offered_player_ids)>3 or jsonb_array_length(p_offered_player_ids)<>jsonb_array_length(p_requested_player_ids) then raise exception 'Trades must be balanced packages of one to three players';end if;
 if (select count(distinct value) from jsonb_array_elements_text(p_offered_player_ids))<>jsonb_array_length(p_offered_player_ids) or (select count(distinct value) from jsonb_array_elements_text(p_requested_player_ids))<>jsonb_array_length(p_requested_player_ids) then raise exception 'A player can only appear once in a trade';end if;
 for v_player in select value from jsonb_array_elements_text(p_offered_player_ids) loop if not exists(select 1 from jsonb_array_elements(coalesce(v_proposer.roster,'[]'::jsonb)) p where p->>'id'=v_player) then raise exception 'Offered player is not on your roster';end if;end loop;
 for v_player in select value from jsonb_array_elements_text(p_requested_player_ids) loop if not exists(select 1 from jsonb_array_elements(coalesce(v_recipient.roster,'[]'::jsonb)) p where p->>'id'=v_player) then raise exception 'Requested player is not on that roster';end if;end loop;
 insert into public.ball_knower_trades(league_id,proposer_member_id,recipient_member_id,offered_player_ids,requested_player_ids,note) values(p_league_id,v_proposer.id,v_recipient.id,p_offered_player_ids,p_requested_player_ids,nullif(left(trim(coalesce(p_note,'')),500),'')) returning id into v_id;
 return v_id;
end $$;
revoke all on function public.propose_ball_knower_trade(text,text,jsonb,jsonb,text) from public,anon;
grant execute on function public.propose_ball_knower_trade(text,text,jsonb,jsonb,text) to authenticated,service_role;

create or replace function public.reset_ball_knower_league_for_next_season(p_league_id text)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_auth uuid:=auth.uid();
begin
 if v_auth is null then raise exception 'Authentication required';end if;
 if not exists(select 1 from public.ball_knower_leagues where id=p_league_id and commissioner_auth_id=v_auth) then raise exception 'Commissioner authorization required';end if;
 delete from public.ball_knower_weekly_scores where league_id=p_league_id;
 delete from public.ball_knower_weekly_lineups where league_id=p_league_id;
 delete from public.ball_knower_injury_rolls where league_id=p_league_id;
 delete from public.ball_knower_live_drafts where league_id=p_league_id;
 update public.ball_knower_trades set status='cancelled',resolved_at=now() where league_id=p_league_id and status in('pending','accepted_pending_review');
 update public.ball_knower_league_members set status='building',roster=null,team_ratings=null,submitted_at=null,live_draft_ready=false,faab_balance=100,ir_player_ids='[]'::jsonb where league_id=p_league_id;
 update public.ball_knower_leagues set status='drafting',season_result=null,rosters_locked=false,draft_countdown_started_at=null,updated_at=now() where id=p_league_id;
 return true;
end $$;
revoke all on function public.reset_ball_knower_league_for_next_season(text) from public,anon;
grant execute on function public.reset_ball_knower_league_for_next_season(text) to authenticated,service_role;
