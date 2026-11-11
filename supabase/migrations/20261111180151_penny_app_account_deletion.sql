-- Penny shares this Supabase project with other apps. Keep app account and
-- deletion scoped to Penny instead of deleting a shared auth.users identity.
create table public.penny_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.penny_accounts enable row level security;
revoke all on public.penny_accounts from anon, authenticated;
grant select, insert on public.penny_accounts to authenticated;
grant all on public.penny_accounts to service_role;
create policy penny_account_owner_select on public.penny_accounts
  for select to authenticated using ((select auth.uid()) = user_id);
create policy penny_account_owner_insert on public.penny_accounts
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- Ensure older Penny records and any new write have an app-owned parent row.
insert into public.penny_accounts(user_id)
select user_id from public.penny_ledgers
union select user_id from public.penny_entitlements
union select user_id from penny_private.penny_play_purchases
union select user_id from penny_private.penny_premium_code_attempts
on conflict do nothing;

create function penny_private.penny_ensure_app_account() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.penny_accounts(user_id) values(new.user_id)
    on conflict do nothing;
  return new;
end;
$$;
revoke all on function penny_private.penny_ensure_app_account() from public, anon, authenticated;
create trigger penny_ledger_ensure_account before insert on public.penny_ledgers
  for each row execute function penny_private.penny_ensure_app_account();
create trigger penny_entitlement_ensure_account before insert on public.penny_entitlements
  for each row execute function penny_private.penny_ensure_app_account();
create trigger penny_purchase_ensure_account before insert on penny_private.penny_play_purchases
  for each row execute function penny_private.penny_ensure_app_account();
create trigger penny_code_attempt_ensure_account before insert on penny_private.penny_premium_code_attempts
  for each row execute function penny_private.penny_ensure_app_account();

-- Deleting only the Penny account row atomically cascades to all Penny data.
-- The shared auth.users identity and other applications remain untouched.
alter table public.penny_ledgers add constraint penny_ledger_account_fk
  foreign key(user_id) references public.penny_accounts(user_id) on delete cascade;
alter table public.penny_entitlements add constraint penny_entitlement_account_fk
  foreign key(user_id) references public.penny_accounts(user_id) on delete cascade;
alter table penny_private.penny_play_purchases add constraint penny_purchase_account_fk
  foreign key(user_id) references public.penny_accounts(user_id) on delete cascade;
alter table penny_private.penny_premium_code_attempts add constraint penny_attempt_account_fk
  foreign key(user_id) references public.penny_accounts(user_id) on delete cascade;
