-- A FOR ALL owner policy also participates in SELECT and duplicated the
-- league-read policy. Split write operations without changing authorization.

drop policy if exists bk_trading_block_owner_write
  on public.ball_knower_trading_block;

create policy bk_trading_block_owner_insert
on public.ball_knower_trading_block
for insert
to authenticated
with check (
  exists (
    select 1
    from public.ball_knower_league_members member
    cross join lateral jsonb_array_elements(
      coalesce(member.roster, '[]'::jsonb)
    ) player(value)
    where member.id = ball_knower_trading_block.member_id
      and member.league_id = ball_knower_trading_block.league_id
      and member.auth_user_id = (select auth.uid())
      and player.value ->> 'id' = ball_knower_trading_block.player_id
  )
);

create policy bk_trading_block_owner_update
on public.ball_knower_trading_block
for update
to authenticated
using (
  exists (
    select 1
    from public.ball_knower_league_members member
    where member.id = ball_knower_trading_block.member_id
      and member.league_id = ball_knower_trading_block.league_id
      and member.auth_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.ball_knower_league_members member
    cross join lateral jsonb_array_elements(
      coalesce(member.roster, '[]'::jsonb)
    ) player(value)
    where member.id = ball_knower_trading_block.member_id
      and member.league_id = ball_knower_trading_block.league_id
      and member.auth_user_id = (select auth.uid())
      and player.value ->> 'id' = ball_knower_trading_block.player_id
  )
);

create policy bk_trading_block_owner_delete
on public.ball_knower_trading_block
for delete
to authenticated
using (
  exists (
    select 1
    from public.ball_knower_league_members member
    where member.id = ball_knower_trading_block.member_id
      and member.league_id = ball_knower_trading_block.league_id
      and member.auth_user_id = (select auth.uid())
  )
);
