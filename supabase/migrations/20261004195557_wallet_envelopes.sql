-- Apply only to Penny's separate project. Each envelope belongs to one wallet.
create or replace function penny_private.penny_validate_ledger() returns trigger language plpgsql security invoker
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
  select exists(select 1 from public.penny_entitlements e where e.user_id = new.user_id and (e.lifetime or (e.status in ('SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED') and e.expires_at > now()))) into premium;
  if not premium then
    if exists(select 1 from jsonb_array_elements(new.data->'categories') c where c->>'icon' not in ('fork', 'basket', 'coffee', 'bag', 'car', 'house', 'heart', 'game', 'plane', 'study', 'pet', 'sparkle', 'gift', 'tshirt', 'coins', 'flower') and (tg_op = 'INSERT' or not exists(select 1 from jsonb_array_elements(old.data->'categories') p where p->>'id' = c->>'id' and p->>'icon' = c->>'icon'))) then raise exception 'Premium is required for this envelope icon'; end if;
    if cat_count > 10 and (tg_op = 'INSERT' or exists(select 1 from jsonb_array_elements(new.data->'categories') c where not exists(select 1 from jsonb_array_elements(old.data->'categories') prev where prev->>'id' = c->>'id'))) then raise exception 'Premium is required for more than 10 envelopes'; end if;
    if account_count > 1 and (tg_op = 'INSERT' or exists(select 1 from jsonb_array_elements(new.data->'accounts') a where not exists(select 1 from jsonb_array_elements(old.data->'accounts') prev where prev->>'id' = a->>'id'))) then raise exception 'Premium is required for multiple accounts'; end if;
  end if;
  if (select count(distinct c->>'id') from jsonb_array_elements(new.data->'categories') c) <> cat_count
     or (select count(distinct a->>'id') from jsonb_array_elements(new.data->'accounts') a) <> account_count then raise exception 'Duplicate or missing IDs'; end if;
  for row_data in select * from jsonb_array_elements(new.data->'categories') loop
    if not coalesce(row_data ?& array['id', 'name', 'budget', 'icon', 'color', 'walletId'], false) or not exists(select 1 from jsonb_array_elements(new.data->'accounts') a where a->>'id' = row_data->>'walletId') or length(row_data->>'name') not between 1 and 40 or (row_data->>'budget') !~ '^\d+$' or (row_data->>'budget')::numeric > 10000000000000 then raise exception 'Invalid envelope'; end if;
  end loop;
  for row_data in select * from jsonb_array_elements(new.data->'accounts') loop
    if not coalesce(row_data ?& array['id', 'name', 'openingBalance', 'icon', 'currency'], false) or row_data->>'currency' !~ '^[A-Z]{3}$' or length(row_data->>'name') not between 1 and 40 or (row_data->>'openingBalance') !~ '^\d+$' or (row_data->>'openingBalance')::numeric > 10000000000000 then raise exception 'Invalid wallet'; end if;
  end loop;
  for row_data in select * from jsonb_array_elements(new.data->'transactions') loop
    if not coalesce(row_data ?& array['id', 'kind', 'amount', 'note', 'date', 'accountId', 'categoryId', 'createdAt'], false) or row_data->>'kind' not in ('expense', 'income') or (row_data->>'amount') !~ '^\d+$' or (row_data->>'amount')::numeric <= 0 or (row_data->>'amount')::numeric > 10000000000000
      or length(row_data->>'note') > 160 or row_data->>'date' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid transaction'; end if;
    perform (row_data->>'date')::date;
    if not exists(select 1 from jsonb_array_elements(new.data->'accounts') a where a->>'id' = row_data->>'accountId') then raise exception 'Transaction account not found'; end if;
    if row_data->>'kind' = 'expense' and not exists(select 1 from jsonb_array_elements(new.data->'categories') c where c->>'id' = row_data->>'categoryId' and c->>'walletId' = row_data->>'accountId') then raise exception 'Transaction envelope does not belong to this wallet'; end if;
  end loop;
  if settings->>'currency' !~ '^[A-Z]{3}$' or (settings->>'resetDay')::int not between 1 and 28 or (settings->>'resetHour')::int not between 0 and 23 or (settings->>'decimals')::int not between 0 and 4 then raise exception 'Invalid settings'; end if;
  new.revision := case when tg_op = 'INSERT' then 1 else old.revision + 1 end;
  new.updated_at := now();
  return new;
end;
$$;
