
create table if not exists public.creator_reference_assets (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('person','product','video_style','combination')),
  name text not null check (char_length(trim(name)) > 0),
  source_assets jsonb not null default '[]'::jsonb check (jsonb_typeof(source_assets) = 'array'),
  profile jsonb not null default '{}'::jsonb check (jsonb_typeof(profile) = 'object'),
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  locks jsonb not null default '[]'::jsonb check (jsonb_typeof(locks) = 'array'),
  negative_constraints text[] not null default '{}',
  version integer not null default 1 check (version > 0),
  status text not null default 'review' check (status in ('draft','analyzing','review','locked','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creator_reference_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.creator_reference_assets(id) on delete cascade,
  version integer not null check (version > 0),
  profile jsonb not null check (jsonb_typeof(profile) = 'object'),
  locks jsonb not null check (jsonb_typeof(locks) = 'array'),
  negative_constraints text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (asset_id, version)
);

create index if not exists creator_reference_assets_status_updated_idx
  on public.creator_reference_assets (status, updated_at desc);
create index if not exists creator_reference_versions_asset_idx
  on public.creator_reference_versions (asset_id, version desc);

alter table public.creator_reference_assets enable row level security;
alter table public.creator_reference_versions enable row level security;

drop policy if exists "creator_reference_assets_select" on public.creator_reference_assets;
drop policy if exists "creator_reference_assets_insert" on public.creator_reference_assets;
drop policy if exists "creator_reference_assets_update" on public.creator_reference_assets;
drop policy if exists "creator_reference_assets_delete" on public.creator_reference_assets;
drop policy if exists "creator_reference_versions_select" on public.creator_reference_versions;
drop policy if exists "creator_reference_versions_insert" on public.creator_reference_versions;

create policy "creator_reference_assets_select"
  on public.creator_reference_assets for select
  to anon, authenticated
  using (true);
create policy "creator_reference_assets_insert"
  on public.creator_reference_assets for insert
  to anon, authenticated
  with check (true);
create policy "creator_reference_assets_update"
  on public.creator_reference_assets for update
  to anon, authenticated
  using (true)
  with check (true);
create policy "creator_reference_assets_delete"
  on public.creator_reference_assets for delete
  to anon, authenticated
  using (true);

create policy "creator_reference_versions_select"
  on public.creator_reference_versions for select
  to anon, authenticated
  using (true);
create policy "creator_reference_versions_insert"
  on public.creator_reference_versions for insert
  to anon, authenticated
  with check (true);

grant select, insert, update, delete on public.creator_reference_assets to anon, authenticated;
grant select, insert on public.creator_reference_versions to anon, authenticated;

create or replace function public.lock_creator_reference_asset(
  p_asset_id uuid,
  p_lock_ids text[]
)
returns setof public.creator_reference_assets
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_asset public.creator_reference_assets%rowtype;
  v_next_version integer;
begin
  select * into v_asset
    from public.creator_reference_assets
   where id = p_asset_id
   for update;

  if not found then
    raise exception 'reference asset not found';
  end if;

  v_next_version := case when v_asset.status = 'locked' then v_asset.version + 1 else v_asset.version end;

  update public.creator_reference_assets
     set locks = coalesce((
           select jsonb_agg(item order by ordinal)
             from jsonb_array_elements(v_asset.locks) with ordinality as entries(item, ordinal)
            where item->>'id' = any(p_lock_ids)
         ), '[]'::jsonb),
         version = v_next_version,
         status = 'locked',
         updated_at = now()
   where id = p_asset_id
   returning * into v_asset;

  insert into public.creator_reference_versions (
    asset_id, version, profile, locks, negative_constraints
  ) values (
    v_asset.id, v_asset.version, v_asset.profile, v_asset.locks, v_asset.negative_constraints
  )
  on conflict (asset_id, version) do update
    set profile = excluded.profile,
        locks = excluded.locks,
        negative_constraints = excluded.negative_constraints;

  return next v_asset;
end;
$$;

revoke all on function public.lock_creator_reference_asset(uuid, text[]) from public;
grant execute on function public.lock_creator_reference_asset(uuid, text[]) to anon, authenticated;
