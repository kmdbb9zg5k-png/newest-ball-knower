-- Build 7: make standard waiver/free-agent defaults explicit in league rows.
-- Missing keys are filled; commissioner custom values are never overwritten.

create or replace function public.normalize_ball_knower_league_transaction_defaults()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  new.settings:=jsonb_build_object(
    'waiverType','priority',
    'freeAgentMode','instant',
    'waiverDays',2,
    'waiverProcessHourUtc',9,
    'waiverRunDays',jsonb_build_array(0,1,2,3,4,5,6)
  )||coalesce(new.settings,'{}'::jsonb);
  return new;
end;$$;

revoke all on function public.normalize_ball_knower_league_transaction_defaults() from public,anon,authenticated;

drop trigger if exists bk_league_transaction_defaults on public.ball_knower_leagues;
create trigger bk_league_transaction_defaults
before insert on public.ball_knower_leagues
for each row execute function public.normalize_ball_knower_league_transaction_defaults();

update public.ball_knower_leagues
set settings=jsonb_build_object(
  'waiverType','priority',
  'freeAgentMode','instant',
  'waiverDays',2,
  'waiverProcessHourUtc',9,
  'waiverRunDays',jsonb_build_array(0,1,2,3,4,5,6)
)||coalesce(settings,'{}'::jsonb)
where not (
  settings ? 'waiverType'
  and settings ? 'freeAgentMode'
  and settings ? 'waiverDays'
  and settings ? 'waiverProcessHourUtc'
  and settings ? 'waiverRunDays'
);
