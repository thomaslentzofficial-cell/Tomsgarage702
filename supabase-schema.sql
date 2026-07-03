
-- Tom's Garage Backend Starter Schema
-- Run this in Supabase SQL Editor.
-- This creates member accounts, vehicles, repair records, invoices, referrals, credits, and role-based access.

create extension if not exists pgcrypto;

-- -----------------------------
-- Helpers
-- -----------------------------

create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'customer'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_user_role() in ('owner', 'admin', 'tech');
$$;

create or replace function public.is_owner()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.current_user_role() = 'owner';
$$;

create or replace function public.make_referral_code()
returns text
language sql
as $$
  select 'TG-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

-- -----------------------------
-- Profiles / Roles
-- -----------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  role text not null default 'customer' check (role in ('owner', 'admin', 'tech', 'customer')),
  referral_code text unique not null default public.make_referral_code(),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_admin_only" on public.profiles;
create policy "profiles_update_admin_only"
on public.profiles
for update
using (public.is_owner() or public.current_user_role() = 'admin')
with check (public.is_owner() or public.current_user_role() = 'admin');

-- Trigger: create profile automatically when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- -----------------------------
-- Vehicles
-- -----------------------------

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  nickname text,
  year_make_model text not null,
  mileage text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.vehicles enable row level security;

drop policy if exists "vehicles_select_own_or_admin" on public.vehicles;
create policy "vehicles_select_own_or_admin"
on public.vehicles
for select
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "vehicles_insert_own_or_admin" on public.vehicles;
create policy "vehicles_insert_own_or_admin"
on public.vehicles
for insert
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "vehicles_update_own_or_admin" on public.vehicles;
create policy "vehicles_update_own_or_admin"
on public.vehicles
for update
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "vehicles_delete_own_or_admin" on public.vehicles;
create policy "vehicles_delete_own_or_admin"
on public.vehicles
for delete
using (owner_id = auth.uid() or public.is_admin());

-- -----------------------------
-- Repair Records
-- -----------------------------

create table if not exists public.repair_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  title text not null,
  status text not null default 'Open' check (status in ('Open', 'Waiting Parts', 'Waiting Approval', 'Complete')),
  notes text,
  cost numeric(10,2) default 0,
  service_date date default current_date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.repair_records enable row level security;

drop policy if exists "repairs_select_own_or_admin" on public.repair_records;
create policy "repairs_select_own_or_admin"
on public.repair_records
for select
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "repairs_insert_admin_only" on public.repair_records;
create policy "repairs_insert_admin_only"
on public.repair_records
for insert
with check (public.is_admin());

drop policy if exists "repairs_update_admin_only" on public.repair_records;
create policy "repairs_update_admin_only"
on public.repair_records
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "repairs_delete_owner_only" on public.repair_records;
create policy "repairs_delete_owner_only"
on public.repair_records
for delete
using (public.is_owner());

-- -----------------------------
-- Invoices
-- -----------------------------

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  title text not null,
  amount numeric(10,2) not null default 0,
  status text not null default 'Open' check (status in ('Open', 'Paid', 'Void')),
  due_date date,
  payment_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.invoices enable row level security;

drop policy if exists "invoices_select_own_or_admin" on public.invoices;
create policy "invoices_select_own_or_admin"
on public.invoices
for select
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "invoices_insert_admin_only" on public.invoices;
create policy "invoices_insert_admin_only"
on public.invoices
for insert
with check (public.is_admin());

drop policy if exists "invoices_update_admin_only" on public.invoices;
create policy "invoices_update_admin_only"
on public.invoices
for update
using (public.is_admin())
with check (public.is_admin());

-- -----------------------------
-- Referral Credits
-- -----------------------------

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_name text,
  referred_phone text,
  referred_email text,
  status text not null default 'Pending' check (status in ('Pending', 'Completed', 'Denied')),
  credit_amount numeric(10,2) default 0,
  created_at timestamptz not null default now()
);

alter table public.referrals enable row level security;

drop policy if exists "referrals_select_own_or_admin" on public.referrals;
create policy "referrals_select_own_or_admin"
on public.referrals
for select
using (referrer_id = auth.uid() or public.is_admin());

drop policy if exists "referrals_insert_own_or_admin" on public.referrals;
create policy "referrals_insert_own_or_admin"
on public.referrals
for insert
with check (referrer_id = auth.uid() or public.is_admin());

drop policy if exists "referrals_update_admin_only" on public.referrals;
create policy "referrals_update_admin_only"
on public.referrals
for update
using (public.is_admin())
with check (public.is_admin());

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10,2) not null default 0,
  reason text,
  source text default 'manual',
  status text not null default 'Active' check (status in ('Active', 'Used', 'Voided')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.credit_ledger enable row level security;

drop policy if exists "credits_select_own_or_admin" on public.credit_ledger;
create policy "credits_select_own_or_admin"
on public.credit_ledger
for select
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "credits_insert_admin_only" on public.credit_ledger;
create policy "credits_insert_admin_only"
on public.credit_ledger
for insert
with check (public.is_admin());

drop policy if exists "credits_update_admin_only" on public.credit_ledger;
create policy "credits_update_admin_only"
on public.credit_ledger
for update
using (public.is_admin())
with check (public.is_admin());

-- -----------------------------
-- Owner Setup
-- -----------------------------
-- After you create your owner account with tomsgarage702@gmail.com in the portal,
-- run this final command in Supabase SQL Editor:

-- update public.profiles
-- set role = 'owner', full_name = 'Thomas Lentz', phone = '725-252-9073'
-- where email = 'tomsgarage702@gmail.com';
