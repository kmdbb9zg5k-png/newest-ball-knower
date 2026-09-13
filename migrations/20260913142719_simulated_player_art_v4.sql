-- Stable, reviewed artwork for the fictional Ball Knower player universe.
-- Public clients may read approved manifests and public CDN objects. Only the
-- server-side service role may create, replace, reject, or approve artwork.

create table if not exists public.ball_knower_simulated_player_art (
  player_id text not null check (player_id ~ '^(solo-[a-z0-9-]{3,80}|bk-001-eli-rodriguez|franchise-rookie-[a-z0-9-]{3,100}|my-player-[a-z0-9-]{3,100})$'),
  team_abbr text not null check (team_abbr ~ '^[A-Z0-9]{2,4}$'),
  uniform_variant text not null check (uniform_variant in ('home','away','alternate')),
  appearance_key text not null check (length(appearance_key) between 8 and 240),
  art_version integer not null check (art_version >= 4),
  identity_fingerprint text not null check (length(identity_fingerprint) between 32 and 1000),
  identity_descriptor jsonb not null check (jsonb_typeof(identity_descriptor)='object'),
  status text not null default 'generating' check (status in ('generating','pending_review','approved','rejected')),
  identity_anchor_path text,
  source_portrait_path text,
  source_full_body_path text,
  avatar_path text,
  row_path text,
  card_path text,
  portrait_path text,
  full_body_path text,
  source_width integer check (source_width is null or source_width >= 768),
  source_height integer check (source_height is null or source_height >= 1536),
  content_sha256 text check (content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$'),
  quality_report jsonb not null default '{}'::jsonb check (jsonb_typeof(quality_report)='object'),
  rejection_reason text,
  generated_at timestamptz,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (player_id,team_abbr,uniform_variant,appearance_key,art_version),
  constraint ball_knower_simulated_art_approved_complete check (
    status <> 'approved' or (
      identity_anchor_path is not null and source_portrait_path is not null and source_full_body_path is not null and
      avatar_path is not null and row_path is not null and card_path is not null and
      portrait_path is not null and full_body_path is not null and
      source_width >= 768 and source_height >= 1536 and
      content_sha256 is not null and reviewed_at is not null
    )
  )
);

create index if not exists ball_knower_simulated_art_approved_lookup_idx
  on public.ball_knower_simulated_player_art(player_id,team_abbr,uniform_variant,art_version desc)
  where status='approved';

alter table public.ball_knower_simulated_player_art enable row level security;

revoke all on table public.ball_knower_simulated_player_art from public,anon,authenticated;
grant select on table public.ball_knower_simulated_player_art to anon,authenticated;

drop policy if exists bk_simulated_art_read_approved on public.ball_knower_simulated_player_art;
create policy bk_simulated_art_read_approved
on public.ball_knower_simulated_player_art
for select
to anon,authenticated
using (status='approved');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'ball-knower-simulated-player-art',
  'ball-knower-simulated-player-art',
  true,
  10485760,
  array['image/webp','image/jpeg']::text[]
)
on conflict(id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- Public buckets bypass RLS only while serving objects. No INSERT, UPDATE, or
-- DELETE policy is created for this bucket. Existing Storage policies are
-- bucket-scoped, so normal clients cannot write here; the renderer uses the
-- server-only service role.

comment on table public.ball_knower_simulated_player_art is
  'Approved fictional player artwork manifests keyed by stable player identity, fictional team uniform, appearance, and art version.';
