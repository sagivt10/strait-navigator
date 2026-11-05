-- Additive private legacy archive only. Never changes old tables or verified sn_entries.
-- Inspect for existing sn_legacy_entries before applying; do not replace a collision.
begin;
create table public.sn_legacy_entries (
  import_key text primary key check (import_key ~ '^legacy_[0-9a-f]{64}$'),
  source jsonb not null check (jsonb_typeof(source) = 'object'),
  normalized jsonb not null check (jsonb_typeof(normalized) = 'object'),
  raw_json text not null,
  raw_sha256 text not null check (raw_sha256 ~ '^[0-9a-f]{64}$'),
  verification text not null default 'legacy_unverified' check (verification = 'legacy_unverified'),
  verified_board_eligible boolean not null default false check (not verified_board_eligible),
  archived_at timestamptz not null default clock_timestamp()
);
alter table public.sn_legacy_entries enable row level security;
revoke all on public.sn_legacy_entries from public, anon, authenticated, service_role;
comment on table public.sn_legacy_entries is 'Private legacy archive. Not replay-verified and never queried by sn_board. Import via separately reviewed owner SQL only.';
commit;
