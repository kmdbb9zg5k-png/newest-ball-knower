-- Keep the shared notification fanout safe when it is attached to tables with
-- different row types. Direct NEW/OLD field references in a shared trigger can
-- be resolved against the wrong trigger relation (for example NEW.is_final on
-- ball_knower_live_drafts). Convert each row to jsonb once and read only the
-- fields owned by the active table branch.
create or replace function ball_knower_private.fantasy_notification_fanout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  u uuid;
  league text;
  next_member text;
  pick jsonb;
  watcher record;
  new_row jsonb := to_jsonb(new);
  old_row jsonb := '{}'::jsonb;
  member_count integer;
  next_pick_index integer;
begin
  if tg_op = 'UPDATE' then
    old_row := to_jsonb(old);
  end if;

  if tg_table_name = 'ball_knower_trades' then
    league := new_row ->> 'league_id';
    select auth_user_id
      into u
      from public.ball_knower_league_members
     where id = case
       when tg_op = 'INSERT' then new_row ->> 'recipient_member_id'
       when new_row ->> 'status' in ('rejected', 'vetoed', 'accepted', 'accepted_pending_review')
         then new_row ->> 'proposer_member_id'
       else new_row ->> 'recipient_member_id'
     end;

    perform ball_knower_private.notify_fantasy_user(
      league,
      u,
      case
        when tg_op = 'INSERT' then 'Trade received'
        else 'Trade ' || replace(new_row ->> 'status', '_', ' ')
      end,
      'Open League Activity for the latest trade update.',
      'trade_' || (new_row ->> 'status')
    );
  elsif tg_table_name = 'ball_knower_waiver_claims' then
    if (old_row ->> 'status') is distinct from (new_row ->> 'status')
       and (new_row ->> 'status') in ('won', 'lost') then
      select league_id, auth_user_id
        into league, u
        from public.ball_knower_league_members
       where id = new_row ->> 'member_id';

      perform ball_knower_private.notify_fantasy_user(
        league,
        u,
        'Waiver ' || (new_row ->> 'status'),
        coalesce(new_row #>> '{player_snapshot,name}', new_row ->> 'player_id')
          || ' · ' || coalesce(new_row ->> 'failure_reason', 'Claim processed'),
        'waiver_' || (new_row ->> 'status')
      );
    end if;
  elsif tg_table_name = 'ball_knower_injuries' then
    select m.league_id, m.auth_user_id
      into league, u
      from public.ball_knower_league_members m
     where m.id = new_row ->> 'member_id';

    perform ball_knower_private.notify_fantasy_user(
      league,
      u,
      'Player status update',
      (new_row ->> 'player_name') || ' is now ' || (new_row ->> 'status') || '.',
      'player_status'
    );
  elsif tg_table_name = 'ball_knower_live_drafts' then
    if (new_row ->> 'status') <> 'active' then
      return new;
    end if;

    if tg_op = 'UPDATE'
       and (old_row ->> 'pick_index') is not distinct from (new_row ->> 'pick_index') then
      return new;
    end if;

    if jsonb_typeof(new_row -> 'order_member_ids') <> 'array' then
      return new;
    end if;

    member_count := jsonb_array_length(new_row -> 'order_member_ids');
    if member_count = 0 then
      return new;
    end if;

    next_pick_index := coalesce((new_row ->> 'pick_index')::integer, 0);
    next_member := new_row -> 'order_member_ids' ->> (
      case
        when mod(next_pick_index / member_count, 2) = 0
          then mod(next_pick_index, member_count)
        else member_count - 1 - mod(next_pick_index, member_count)
      end
    );

    select auth_user_id
      into u
      from public.ball_knower_league_members
     where league_id = new_row ->> 'league_id'
       and id = next_member;

    perform ball_knower_private.notify_fantasy_user(
      new_row ->> 'league_id',
      u,
      'You are on the clock',
      'Your Ball Knower fantasy pick is ready.',
      'draft_on_clock'
    );

    if tg_op = 'UPDATE'
       and jsonb_typeof(new_row -> 'picks') = 'array'
       and jsonb_array_length(new_row -> 'picks') > 0 then
      pick := new_row -> 'picks' -> -1;
      if pick ->> 'source' = 'autopick' then
        select auth_user_id
          into u
          from public.ball_knower_league_members
         where league_id = new_row ->> 'league_id'
           and id = pick ->> 'memberId';

        perform ball_knower_private.notify_fantasy_user(
          new_row ->> 'league_id',
          u,
          'Selection autopicked',
          'Your queue or best available player made the pick.',
          'draft_autopick'
        );
      end if;
    end if;
  elsif tg_table_name = 'ball_knower_league_messages' then
    for watcher in
      select auth_user_id
        from public.ball_knower_league_members
       where league_id = new_row ->> 'league_id'
         and auth_user_id is not null
         and auth_user_id <> (new_row ->> 'auth_user_id')::uuid
         and not is_ai
    loop
      perform ball_knower_private.notify_fantasy_user(
        new_row ->> 'league_id',
        watcher.auth_user_id,
        'League message',
        (new_row ->> 'member_name') || ': ' || left(new_row ->> 'body', 180),
        'league_message'
      );
    end loop;
  elsif tg_table_name = 'ball_knower_trading_block' then
    for watcher in
      select watched.auth_user_id
        from public.ball_knower_watched_players watched
       where watched.league_id = new_row ->> 'league_id'
         and watched.player_id = new_row ->> 'player_id'
         and exists (
           select 1
             from public.ball_knower_league_members m
            where m.league_id = new_row ->> 'league_id'
              and m.auth_user_id = watched.auth_user_id
              and not m.is_ai
         )
    loop
      perform ball_knower_private.notify_fantasy_user(
        new_row ->> 'league_id',
        watcher.auth_user_id,
        'Watched player on Trading Block',
        (new_row ->> 'player_id') || ' is marked '
          || replace(new_row ->> 'status', '_', ' ') || '.',
        'trading_block'
      );
    end loop;
  elsif tg_table_name = 'ball_knower_weekly_scores' then
    if not coalesce((new_row ->> 'is_final')::boolean, false) then
      return new;
    end if;

    if tg_op = 'UPDATE'
       and coalesce((old_row ->> 'is_final')::boolean, false) then
      return new;
    end if;

    select auth_user_id
      into u
      from public.ball_knower_league_members
     where id = new_row ->> 'member_id';

    perform ball_knower_private.notify_fantasy_user(
      new_row ->> 'league_id',
      u,
      'Final matchup result',
      'Your Week ' || (new_row ->> 'week_number') || ' score is final: '
        || (new_row ->> 'live_points') || ' points.',
      'matchup_final'
    );
  end if;

  return new;
end;
$function$;

revoke all on function ball_knower_private.fantasy_notification_fanout()
  from public, anon, authenticated;

comment on function ball_knower_private.fantasy_notification_fanout() is
  'Schema-safe notification fanout. NEW/OLD are converted to jsonb because the function is shared by heterogeneous trigger tables.';
