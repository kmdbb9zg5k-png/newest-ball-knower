-- Harden Fantasy League write authorization without changing client response shapes.
-- Applied to the connected Supabase project on 2026-08-20.

-- Trade proposals must originate from the authenticated proposer, remain inside
-- one league, exchange equal player counts, and reference players actually
-- owned by the proposer/recipient at insert time.
drop policy if exists bk_trades_member_write on public.ball_knower_trades;
create policy bk_trades_member_write
on public.ball_knower_trades
for insert
to authenticated
with check (
  proposer_member_id <> recipient_member_id
  and coalesce(array_length(offered_player_ids, 1), 0) > 0
  and coalesce(array_length(offered_player_ids, 1), 0) = coalesce(array_length(requested_player_ids, 1), 0)
  and exists (
    select 1
    from public.ball_knower_league_members proposer
    join public.ball_knower_league_members recipient
      on recipient.league_id = proposer.league_id
     and recipient.id = recipient_member_id
    where proposer.league_id = ball_knower_trades.league_id
      and proposer.id = proposer_member_id
      and proposer.auth_user_id = (select auth.uid())
      and not exists (
        select 1
        from unnest(offered_player_ids) as offered_id
        where not exists (
          select 1
          from jsonb_array_elements(coalesce(proposer.roster, '[]'::jsonb)) as player
          where player->>'id' = offered_id
        )
      )
      and not exists (
        select 1
        from unnest(requested_player_ids) as requested_id
        where not exists (
          select 1
          from jsonb_array_elements(coalesce(recipient.roster, '[]'::jsonb)) as player
          where player->>'id' = requested_id
        )
      )
  )
);

-- Chat identity must match the authenticated league member. Only the league
-- commissioner may insert announcement rows.
drop policy if exists bk_messages_member_insert on public.ball_knower_league_messages;
create policy bk_messages_member_insert
on public.ball_knower_league_messages
for insert
to authenticated
with check (
  auth_user_id = (select auth.uid())
  and kind in ('chat','announcement','receipt','reaction')
  and exists (
    select 1
    from public.ball_knower_league_members member
    where member.league_id = ball_knower_league_messages.league_id
      and member.auth_user_id = (select auth.uid())
      and member.user_name = ball_knower_league_messages.member_name
  )
  and (kind <> 'announcement' or public.is_ball_knower_commissioner(league_id))
);
