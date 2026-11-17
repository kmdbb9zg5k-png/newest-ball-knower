-- A published showcase is an explicit snapshot of in-game cosmetics.
-- Never store account fields, uploaded portraits or a local athlete identifier.
create table public.ball_knower_profile_showcases (
  user_id uuid primary key references auth.users(id) on delete cascade,
  fit jsonb not null,
  constraint bk_showcase_fit_size check (octet_length(fit::text) <= 1200),
  constraint bk_showcase_fit_shape check (
    jsonb_typeof(fit) = 'object'
    and fit ?& array['position','heightInches','weightLbs','bodyBuild','shoulderWidth','armSize','legSize','bodyPresetId',
      'skinTone','hairStyle','hairColor','facialHair','tattooCoverage','tattooStyle','tattooArms','number','wardrobe']
    and fit - array['position','heightInches','weightLbs','bodyBuild','shoulderWidth','armSize','legSize','bodyPresetId',
      'skinTone','hairStyle','hairColor','facialHair','tattooCoverage','tattooStyle','tattooArms','number','wardrobe'] = '{}'::jsonb
    and jsonb_typeof(fit->'wardrobe') = 'object'
    and fit->'wardrobe' ?& array['top','shorts','shoes','wrist']
    and (fit->'wardrobe') - array['top','shorts','shoes','wrist'] = '{}'::jsonb
    and jsonb_typeof(fit->'heightInches') = 'number'
    and jsonb_typeof(fit->'weightLbs') = 'number'
    and jsonb_typeof(fit->'bodyBuild') = 'number'
    and jsonb_typeof(fit->'shoulderWidth') = 'number'
    and jsonb_typeof(fit->'armSize') = 'number'
    and jsonb_typeof(fit->'legSize') = 'number'
    and jsonb_typeof(fit->'number') = 'number'
    and (fit->>'bodyPresetId') is not distinct from 'custom'
    and coalesce(fit->>'position','') in ('QB','RB','WR','TE','EDGE','LB','CB','S')
    and coalesce(fit->>'skinTone','') ~ '^[a-z -]{1,32}$'
    and coalesce(fit->>'hairStyle','') ~ '^[a-z -]{1,32}$'
    and coalesce(fit->>'hairColor','') ~ '^[a-z -]{1,32}$'
    and coalesce(fit->>'facialHair','') ~ '^[a-z -]{1,32}$'
    and coalesce(fit->>'tattooCoverage','') ~ '^[a-z -]{1,32}$'
    and coalesce(fit->>'tattooStyle','') ~ '^[a-z -]{1,32}$'
    and coalesce(fit->>'tattooArms','') in ('left','right','both')
    and coalesce(fit#>>'{wardrobe,top}','') ~ '^top-[a-z0-9-]{1,48}$'
    and coalesce(fit#>>'{wardrobe,shorts}','') ~ '^shorts-[a-z0-9-]{1,48}$'
    and coalesce(fit#>>'{wardrobe,shoes}','') ~ '^shoes-[a-z0-9-]{1,48}$'
    and coalesce(fit#>>'{wardrobe,wrist}','') ~ '^wrist-[a-z0-9-]{1,48}$'
  )
);

alter table public.ball_knower_profile_showcases enable row level security;
revoke all on public.ball_knower_profile_showcases from public, anon, authenticated;
grant select, insert, update, delete on public.ball_knower_profile_showcases to authenticated;

create policy bk_showcase_read on public.ball_knower_profile_showcases for select to authenticated
  using (not coalesce((select auth.jwt()->>'is_anonymous') = 'true', false)
    and public.ball_knower_can_see_sender(user_id));
create policy bk_showcase_insert on public.ball_knower_profile_showcases for insert to authenticated
  with check (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous') = 'true', false));
create policy bk_showcase_update on public.ball_knower_profile_showcases for update to authenticated
  using (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous') = 'true', false))
  with check (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous') = 'true', false));
create policy bk_showcase_delete on public.ball_knower_profile_showcases for delete to authenticated
  using (user_id = (select auth.uid()) and not coalesce((select auth.jwt()->>'is_anonymous') = 'true', false));
