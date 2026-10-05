-- Deploy ONLY to Penny's separate project. No existing project has been modified.
create schema if not exists penny_private;
revoke all on schema penny_private from public, anon, authenticated;

create table public.penny_ledgers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
create table public.penny_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expires_at timestamptz,
  status text not null default 'inactive',
  ever_premium boolean not null default false,
  checked_at timestamptz not null default now()
);
create table penny_private.penny_play_purchases (
  purchase_token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  expires_at timestamptz,
  status text not null,
  updated_at timestamptz not null default now()
);
create index penny_play_purchases_owner on penny_private.penny_play_purchases(user_id);
alter table public.penny_ledgers enable row level security;
alter table public.penny_entitlements enable row level security;
alter table penny_private.penny_play_purchases enable row level security;
revoke all on public.penny_ledgers, public.penny_entitlements from anon, authenticated;
grant select, insert, update, delete on public.penny_ledgers to authenticated;
grant select on public.penny_entitlements to authenticated;
grant usage on schema penny_private to service_role;
grant all on penny_private.penny_play_purchases to service_role;
grant all on public.penny_ledgers, public.penny_entitlements to service_role;

create policy penny_ledger_owner on public.penny_ledgers for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy penny_entitlement_owner on public.penny_entitlements for select to authenticated
using ((select auth.uid()) = user_id);

create function penny_private.penny_validate_ledger() returns trigger language plpgsql security invoker
set search_path = '' as $$
declare
  premium boolean;
  row_data jsonb;
  settings jsonb := new.data->'settings';
  cat_count int;
  account_count int;
begin
  if not coalesce(new.data ?& array['schemaVersion', 'demo', 'categories', 'accounts', 'transactions', 'settings'], false)
     or jsonb_typeof(new.data->'schemaVersion') is distinct from 'number'
     or jsonb_typeof(new.data->'demo') is distinct from 'boolean'
     or jsonb_typeof(new.data->'categories') is distinct from 'array'
     or jsonb_typeof(new.data->'accounts') is distinct from 'array'
     or jsonb_typeof(new.data->'transactions') is distinct from 'array'
     or jsonb_typeof(settings) is distinct from 'object' then
    raise exception 'Invalid ledger format';
  end if;
  if octet_length(new.data::text) > 20000000 or new.data->>'schemaVersion' <> '1' or new.data->>'demo' <> 'false'
     or jsonb_typeof(new.data->'categories') <> 'array' or jsonb_typeof(new.data->'accounts') <> 'array'
     or jsonb_typeof(new.data->'transactions') <> 'array' or jsonb_typeof(settings) <> 'object' then
    raise exception 'Invalid ledger format';
  end if;
  cat_count := jsonb_array_length(new.data->'categories'); account_count := jsonb_array_length(new.data->'accounts');
  if jsonb_array_length(new.data->'transactions') > 100000 then raise exception 'Ledger limit exceeded'; end if;
  select exists(select 1 from public.penny_entitlements e where e.user_id = new.user_id and e.status in ('SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED') and e.expires_at > now()) into premium;
  if not premium then
    if exists(select 1 from jsonb_array_elements(new.data->'categories') c where c->>'icon' not in ('fork', 'basket', 'coffee', 'bag', 'car', 'house', 'heart', 'game', 'plane', 'study', 'pet', 'sparkle', 'gift', 'tshirt', 'coins', 'flower') and (tg_op = 'INSERT' or not exists(select 1 from jsonb_array_elements(old.data->'categories') p where p->>'id' = c->>'id' and p->>'icon' = c->>'icon'))) then raise exception 'Premium is required for this category icon'; end if;
    if cat_count > 10 and (tg_op = 'INSERT' or exists(select 1 from jsonb_array_elements(new.data->'categories') c where not exists(select 1 from jsonb_array_elements(old.data->'categories') prev where prev->>'id' = c->>'id'))) then raise exception 'Premium is required for more than 10 categories'; end if;
    if account_count > 1 and (tg_op = 'INSERT' or exists(select 1 from jsonb_array_elements(new.data->'accounts') a where not exists(select 1 from jsonb_array_elements(old.data->'accounts') prev where prev->>'id' = a->>'id'))) then raise exception 'Premium is required for multiple accounts'; end if;
  end if;
  if (select count(distinct c->>'id') from jsonb_array_elements(new.data->'categories') c) <> cat_count
     or (select count(distinct a->>'id') from jsonb_array_elements(new.data->'accounts') a) <> account_count then raise exception 'Duplicate or missing IDs'; end if;
  for row_data in select * from jsonb_array_elements(new.data->'categories') loop
    if not coalesce(row_data ?& array['id', 'name', 'budget', 'icon', 'color'], false) or length(row_data->>'name') not between 1 and 40 or (row_data->>'budget') !~ '^\d+$' or (row_data->>'budget')::numeric > 10000000000000 then raise exception 'Invalid category'; end if;
  end loop;
  for row_data in select * from jsonb_array_elements(new.data->'accounts') loop
    if not coalesce(row_data ?& array['id', 'name', 'openingBalance', 'icon', 'currency'], false) or row_data->>'currency' !~ '^[A-Z]{3}$' or length(row_data->>'name') not between 1 and 40 or (row_data->>'openingBalance') !~ '^\d+$' or (row_data->>'openingBalance')::numeric > 10000000000000 then raise exception 'Invalid wallet'; end if;
  end loop;
  for row_data in select * from jsonb_array_elements(new.data->'transactions') loop
    if not coalesce(row_data ?& array['id', 'kind', 'amount', 'note', 'date', 'accountId', 'categoryId', 'createdAt'], false) or row_data->>'kind' not in ('expense', 'income') or (row_data->>'amount') !~ '^\d+$' or (row_data->>'amount')::numeric <= 0 or (row_data->>'amount')::numeric > 10000000000000
      or length(row_data->>'note') > 160 or row_data->>'date' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid transaction'; end if;
    perform (row_data->>'date')::date;
    if not exists(select 1 from jsonb_array_elements(new.data->'accounts') a where a->>'id' = row_data->>'accountId') then raise exception 'Transaction account not found'; end if;
    if row_data->>'kind' = 'expense' and not exists(select 1 from jsonb_array_elements(new.data->'categories') c where c->>'id' = row_data->>'categoryId') then raise exception 'Transaction category not found'; end if;
  end loop;
  if settings->>'currency' !~ '^[A-Z]{3}$' or (settings->>'resetDay')::int not between 1 and 28 or (settings->>'resetHour')::int not between 0 and 23 or (settings->>'decimals')::int not between 0 and 4 then raise exception 'Invalid settings'; end if;
  new.revision := case when tg_op = 'INSERT' then 1 else old.revision + 1 end;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function penny_private.penny_validate_ledger() from public, anon, authenticated;
create trigger penny_ledger_validation before insert or update on public.penny_ledgers for each row execute function penny_private.penny_validate_ledger();

create function public.penny_save_ledger(ledger_data jsonb, expected_revision bigint) returns bigint language plpgsql security invoker
set search_path = '' as $$
declare current_revision bigint; next_revision bigint; owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  select revision into current_revision from public.penny_ledgers where user_id = owner_id for update;
  if current_revision is null then
    if expected_revision <> 0 then raise exception 'CONFLICT: cloud ledger was changed or deleted'; end if;
    insert into public.penny_ledgers(user_id, data) values(owner_id, ledger_data) returning revision into next_revision;
  else
    if current_revision <> expected_revision then raise exception 'CONFLICT: another device has newer changes'; end if;
    update public.penny_ledgers set data = ledger_data where user_id = owner_id returning revision into next_revision;
  end if;
  return next_revision;
exception when unique_violation then raise exception 'CONFLICT: another device created this ledger';
end;
$$;
revoke all on function public.penny_save_ledger(jsonb, bigint) from public, anon;
grant execute on function public.penny_save_ledger(jsonb, bigint) to authenticated;

-- Service-only RPCs keep purchase tokens outside the exposed schema.
create function public.penny_store_play_purchase(token text, owner_id uuid, product text, expiry timestamptz, state text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  insert into penny_private.penny_play_purchases(purchase_token, user_id, product_id, expires_at, status)
  values(token, owner_id, product, expiry, state)
  on conflict(purchase_token) do update set expires_at = excluded.expires_at, status = excluded.status, updated_at = now()
  where penny_private.penny_play_purchases.user_id = excluded.user_id;
  if not found then raise exception 'Purchase belongs to another account'; end if;
  insert into public.penny_entitlements(user_id, expires_at, status, ever_premium, checked_at)
  select owner_id, p.expires_at, p.status, true, now() from penny_private.penny_play_purchases p where p.user_id = owner_id
  order by (p.status in ('SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED') and p.expires_at > now()) desc nulls last, p.expires_at desc nulls last limit 1
  on conflict(user_id) do update set expires_at = excluded.expires_at, status = excluded.status, ever_premium = true, checked_at = now();
end; $$;
create function public.penny_get_play_purchases(owner_id uuid) returns table(purchase_token text, product_id text)
language sql security invoker set search_path = '' as $$ select purchase_token, product_id from penny_private.penny_play_purchases where user_id = owner_id order by updated_at desc limit 20; $$;
revoke all on function public.penny_store_play_purchase(text, uuid, text, timestamptz, text), public.penny_get_play_purchases(uuid) from public, anon, authenticated;
grant execute on function public.penny_store_play_purchase(text, uuid, text, timestamptz, text), public.penny_get_play_purchases(uuid) to service_role;
