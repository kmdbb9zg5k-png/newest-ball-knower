create table public.bk_wardrobe_redemptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code_hash text check (code_hash ~ '^[a-f0-9]{64}$'),
  redeemed_at timestamptz,
  outfit jsonb,
  check ((code_hash is null) = (redeemed_at is not null))
);

alter table public.bk_wardrobe_redemptions enable row level security;
revoke all on public.bk_wardrobe_redemptions from public, anon, authenticated;
grant select, insert, update, delete on public.bk_wardrobe_redemptions to service_role;
