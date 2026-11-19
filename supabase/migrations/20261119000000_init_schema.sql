-- supabase/migrations/20261119000000_init_schema.sql
-- Doce Agenda v2 — schema inicial

-- profiles
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text,
  slug text unique,
  theme_style text check (theme_style in ('atelie','doceria','caseira','moderna')),
  cover_url text,
  logo_url text,
  pix_key text,
  default_weekly_capacity jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "profiles: owner full access" on public.profiles
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- catalog_items
create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  price_cents int not null default 0 check (price_cents >= 0),
  slots_required int not null default 1 check (slots_required between 1 and 10),
  photo_url text,
  active boolean not null default true
);
alter table public.catalog_items enable row level security;
create policy "catalog_items: owner full access" on public.catalog_items
  for all to authenticated
  using (profile_id in (select id from public.profiles where user_id = auth.uid()))
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));

-- orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  public_code text unique,
  customer_name text,
  customer_whatsapp text,
  items jsonb default '[]'::jsonb,
  delivery_type text check (delivery_type in ('retirada','entrega')),
  delivery_address text,
  scheduled_date date,
  scheduled_time time,
  status text not null default 'solicitacao' check (status in ('solicitacao','orcamento','aguardando_confirmacao','cancelado','recusado','confirmado','em_producao','pronto','entregue')),
  total_cents int not null default 0,
  notes text,
  capacity_override_reason text,
  created_at timestamptz default now()
);
alter table public.orders enable row level security;
create policy "orders: owner full access" on public.orders
  for all to authenticated
  using (profile_id in (select id from public.profiles where user_id = auth.uid()))
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));

-- order_payments
create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount_cents int not null default 0 check (amount_cents >= 0),
  status text not null check (status in ('informado','conferido')),
  paid_at timestamptz default now()
);
alter table public.order_payments enable row level security;
create policy "order_payments: owner via order" on public.order_payments
  for all to authenticated
  using (order_id in (
    select o.id from public.orders o
    join public.profiles p on p.id = o.profile_id
    where p.user_id = auth.uid()
  ))
  with check (order_id in (
    select o.id from public.orders o
    join public.profiles p on p.id = o.profile_id
    where p.user_id = auth.uid()
  ));

-- date_overrides
create table if not exists public.date_overrides (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  target_date date not null,
  max_slots int check (max_slots is null or max_slots >= 0),
  is_closed boolean not null default false,
  reason text,
  unique (profile_id, target_date)
);
alter table public.date_overrides enable row level security;
create policy "date_overrides: owner full access" on public.date_overrides
  for all to authenticated
  using (profile_id in (select id from public.profiles where user_id = auth.uid()))
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));

-- public_submissions
create table if not exists public.public_submissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  payload jsonb default '{}'::jsonb,
  status text not null default 'pendente' check (status in ('pendente','aceito','recusado')),
  created_at timestamptz default now(),
  anonymize_after timestamptz
);
alter table public.public_submissions enable row level security;
-- public can insert submissions (anon), owner can read/update
create policy "public_submissions: anon insert" on public.public_submissions
  for insert to anon with check (true);
create policy "public_submissions: owner read/update" on public.public_submissions
  for all to authenticated
  using (profile_id in (select id from public.profiles where user_id = auth.uid()))
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));
