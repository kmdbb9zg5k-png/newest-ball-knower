-- Complete permanent-account claims with the two remaining auth-owned
-- aggregates. The trigger runs inside claim_ball_knower_guest_merge's
-- transaction when a claim changes from unclaimed to claimed.
create or replace function ball_knower_private.merge_guest_account_aggregates()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if new.guest_user_id is null or new.claimed_by is null then
    raise exception 'Claimed guest and permanent identities are required';
  end if;

  insert into public.ball_knower_leaderboard as permanent(
    auth_user_id,display_name,championships,career_wins,career_losses,
    playoff_wins,best_ball_knower_score,bk_rating,best_record,
    perfect_seasons,favorite_team,achievements,best_roster,
    last_run_summary,updated_at
  )
  select
    new.claimed_by,guest.display_name,guest.championships,guest.career_wins,
    guest.career_losses,guest.playoff_wins,guest.best_ball_knower_score,
    guest.bk_rating,guest.best_record,guest.perfect_seasons,
    guest.favorite_team,guest.achievements,guest.best_roster,
    guest.last_run_summary,guest.updated_at
  from public.ball_knower_leaderboard guest
  where guest.auth_user_id=new.guest_user_id
  on conflict(auth_user_id) do update set
    display_name=case when excluded.updated_at>permanent.updated_at
      then excluded.display_name else permanent.display_name end,
    championships=permanent.championships+excluded.championships,
    career_wins=permanent.career_wins+excluded.career_wins,
    career_losses=permanent.career_losses+excluded.career_losses,
    playoff_wins=permanent.playoff_wins+excluded.playoff_wins,
    best_ball_knower_score=greatest(
      permanent.best_ball_knower_score,excluded.best_ball_knower_score
    ),
    bk_rating=greatest(permanent.bk_rating,excluded.bk_rating),
    best_record=case
      when excluded.best_record~'^\d+-\d+$'
        and (
          permanent.best_record!~'^\d+-\d+$'
          or (
            split_part(excluded.best_record,'-',1)::integer,
            -split_part(excluded.best_record,'-',2)::integer
          )>(
            split_part(permanent.best_record,'-',1)::integer,
            -split_part(permanent.best_record,'-',2)::integer
          )
          or (
            (
              split_part(excluded.best_record,'-',1)::integer,
              -split_part(excluded.best_record,'-',2)::integer
            )=(
              split_part(permanent.best_record,'-',1)::integer,
              -split_part(permanent.best_record,'-',2)::integer
            )
            and excluded.updated_at>permanent.updated_at
          )
        )
      then excluded.best_record else permanent.best_record end,
    perfect_seasons=permanent.perfect_seasons+excluded.perfect_seasons,
    favorite_team=case when excluded.updated_at>permanent.updated_at
      then coalesce(excluded.favorite_team,permanent.favorite_team)
      else coalesce(permanent.favorite_team,excluded.favorite_team) end,
    achievements=(
      select coalesce(jsonb_agg(item order by item::text),'[]'::jsonb)
      from (
        select distinct item
        from jsonb_array_elements(
          case when jsonb_typeof(permanent.achievements)='array'
            then permanent.achievements else '[]'::jsonb end
          ||
          case when jsonb_typeof(excluded.achievements)='array'
            then excluded.achievements else '[]'::jsonb end
        ) item
      ) unique_items
    ),
    best_roster=case
      when excluded.best_ball_knower_score>permanent.best_ball_knower_score
        or (
          excluded.best_ball_knower_score=permanent.best_ball_knower_score
          and excluded.updated_at>permanent.updated_at
        )
      then coalesce(excluded.best_roster,permanent.best_roster)
      else coalesce(permanent.best_roster,excluded.best_roster) end,
    last_run_summary=case when excluded.updated_at>permanent.updated_at
      then coalesce(excluded.last_run_summary,permanent.last_run_summary)
      else coalesce(permanent.last_run_summary,excluded.last_run_summary) end,
    updated_at=greatest(permanent.updated_at,excluded.updated_at);

  delete from public.ball_knower_leaderboard
  where auth_user_id=new.guest_user_id;

  insert into public.ball_knower_owner_profiles as permanent(
    auth_user_id,display_name,ball_knower_rating,career_wins,career_losses,
    career_ties,championships,leagues_played,best_finish,badges,
    favorite_team,updated_at
  )
  select
    new.claimed_by,guest.display_name,guest.ball_knower_rating,
    guest.career_wins,guest.career_losses,guest.career_ties,
    guest.championships,guest.leagues_played,guest.best_finish,
    guest.badges,guest.favorite_team,guest.updated_at
  from public.ball_knower_owner_profiles guest
  where guest.auth_user_id=new.guest_user_id
  on conflict(auth_user_id) do update set
    display_name=case when excluded.updated_at>permanent.updated_at
      then excluded.display_name else permanent.display_name end,
    ball_knower_rating=case
      when permanent.leagues_played+excluded.leagues_played>0 then
        greatest(0,least(100,round((
          permanent.ball_knower_rating*permanent.leagues_played
          +excluded.ball_knower_rating*excluded.leagues_played
        )::numeric/(permanent.leagues_played+excluded.leagues_played))::integer))
      else greatest(permanent.ball_knower_rating,excluded.ball_knower_rating)
    end,
    career_wins=permanent.career_wins+excluded.career_wins,
    career_losses=permanent.career_losses+excluded.career_losses,
    career_ties=permanent.career_ties+excluded.career_ties,
    championships=permanent.championships+excluded.championships,
    leagues_played=permanent.leagues_played+excluded.leagues_played,
    best_finish=case
      when permanent.best_finish is null then excluded.best_finish
      when excluded.best_finish is null then permanent.best_finish
      else least(permanent.best_finish,excluded.best_finish)
    end,
    badges=(
      select coalesce(jsonb_agg(item order by item::text),'[]'::jsonb)
      from (
        select distinct item
        from jsonb_array_elements(
          case when jsonb_typeof(permanent.badges)='array'
            then permanent.badges else '[]'::jsonb end
          ||
          case when jsonb_typeof(excluded.badges)='array'
            then excluded.badges else '[]'::jsonb end
        ) item
      ) unique_items
    ),
    favorite_team=case when excluded.updated_at>permanent.updated_at
      then coalesce(excluded.favorite_team,permanent.favorite_team)
      else coalesce(permanent.favorite_team,excluded.favorite_team) end,
    updated_at=greatest(permanent.updated_at,excluded.updated_at);

  delete from public.ball_knower_owner_profiles
  where auth_user_id=new.guest_user_id;

  return new;
end;
$function$;

revoke all on function ball_knower_private.merge_guest_account_aggregates()
from public,anon,authenticated;

drop trigger if exists merge_guest_account_aggregates_on_claim
on public.ball_knower_guest_account_claims;
create trigger merge_guest_account_aggregates_on_claim
before update of claimed_at on public.ball_knower_guest_account_claims
for each row
when (old.claimed_at is null and new.claimed_at is not null)
execute function ball_knower_private.merge_guest_account_aggregates();
