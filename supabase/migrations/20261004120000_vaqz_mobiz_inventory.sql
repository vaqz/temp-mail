-- Vaqz Mobiz Inventory / Commerce foundation
-- PostgreSQL / Supabase
-- Product catalog is intentionally independent from the existing D1 mail system.

create extension if not exists pgcrypto;

create type product_status as enum ('draft','active','archived');
create type selling_mode as enum ('ORIG','SOLO','SH');
create type customer_type as enum ('retail','reseller','vip_reseller');
create type credential_status as enum ('active','retired','suspended');
create type allocation_status as enum ('available','reserved','active','expired','released','blocked');
create type subscription_status as enum ('pending','active','expired','cancelled','suspended');
create type order_status as enum ('pending','paid','fulfilled','cancelled','refunded');
create type field_type as enum ('text','number','boolean','date','datetime','select','textarea');

create table products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  status product_status not null default 'draft',
  default_currency char(3) not null default 'PHP',
  default_term_months integer not null default 1 check (default_term_months > 0),
  customer_delivery_template text,
  internal_notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table product_fields (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  field_key text not null,
  label text not null,
  field_type field_type not null default 'text',
  required boolean not null default false,
  customer_visible boolean not null default true,
  sort_order integer not null default 0,
  options jsonb not null default '[]'::jsonb,
  default_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, field_key)
);

create table product_rules (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  title text not null,
  rule_text text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  mode selling_mode not null,
  display_name text not null,
  capacity integer not null default 1 check (capacity > 0),
  max_customers_per_credential integer not null default 1 check (max_customers_per_credential > 0),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, mode)
);

create table pricing_tiers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  customer_type customer_type not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table product_prices (
  id uuid primary key default gen_random_uuid(),
  product_variant_id uuid not null references product_variants(id) on delete cascade,
  pricing_tier_id uuid not null references pricing_tiers(id) on delete restrict,
  term_months integer not null check (term_months in (1,3,6,12)),
  base_price numeric(12,2) not null check (base_price >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  active boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  unique(product_variant_id, pricing_tier_id, term_months, valid_from)
);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contact_name text,
  contact_details text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table credentials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete restrict,
  supplier_id uuid references suppliers(id) on delete set null,
  label text,
  account_identifier text not null,
  password_encrypted text,
  credential_data jsonb not null default '{}'::jsonb,
  status credential_status not null default 'active',
  password_reset_due_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(product_id, account_identifier)
);

create table credential_allocations (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references credentials(id) on delete cascade,
  product_variant_id uuid not null references product_variants(id) on delete restrict,
  slot_key text not null,
  slot_label text,
  allocation_status allocation_status not null default 'available',
  allocation_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(credential_id, slot_key)
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  customer_code text not null unique,
  customer_type customer_type not null default 'retail',
  display_name text,
  messenger_id text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references customers(id) on delete set null,
  status order_status not null default 'pending',
  currency char(3) not null default 'PHP',
  subtotal numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_variant_id uuid not null references product_variants(id) on delete restrict,
  term_months integer not null check (term_months in (1,3,6,12)),
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  discount_amount numeric(12,2) not null default 0,
  line_total numeric(12,2) not null default 0,
  allocation_notes text,
  created_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete restrict,
  order_item_id uuid references order_items(id) on delete set null,
  allocation_id uuid references credential_allocations(id) on delete set null,
  status subscription_status not null default 'pending',
  starts_at timestamptz,
  expires_at timestamptz,
  auto_renew_requested boolean not null default false,
  renewal_price numeric(12,2),
  customer_notes text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  amount numeric(12,2) not null check (amount >= 0),
  currency char(3) not null default 'PHP',
  method text,
  reference text,
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table credential_events (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid references credentials(id) on delete cascade,
  allocation_id uuid references credential_allocations(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_product_fields_product on product_fields(product_id, sort_order);
create index idx_product_rules_product on product_rules(product_id, sort_order);
create index idx_product_variants_product on product_variants(product_id, mode);
create index idx_product_prices_variant on product_prices(product_variant_id, term_months);
create index idx_credentials_product_status on credentials(product_id, status);
create index idx_allocations_credential_status on credential_allocations(credential_id, allocation_status);
create index idx_allocations_variant_status on credential_allocations(product_variant_id, allocation_status);
create index idx_subscriptions_customer_status on subscriptions(customer_id, status);
create index idx_subscriptions_expiry on subscriptions(expires_at, status);
create index idx_orders_customer on orders(customer_id, created_at desc);

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['products','product_fields','product_rules','product_variants','suppliers','credentials','credential_allocations','customers','orders','subscriptions'] loop
    execute format('drop trigger if exists trg_%s_updated_at on %I', t, t);
    execute format('create trigger trg_%s_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

create or replace view product_availability as
select
  pv.id as product_variant_id,
  p.id as product_id,
  p.code as product_code,
  p.name as product_name,
  pv.mode,
  pv.display_name,
  pv.capacity,
  count(ca.id) filter (where ca.allocation_status in ('available','reserved')) as configured_slots,
  count(ca.id) filter (where ca.allocation_status = 'available') as available_slots,
  count(ca.id) filter (where ca.allocation_status = 'active') as active_slots
from product_variants pv
join products p on p.id = pv.product_id
left join credential_allocations ca on ca.product_variant_id = pv.id
where p.status = 'active' and pv.active = true
group by pv.id, p.id;

insert into pricing_tiers (code,name,customer_type) values
  ('RETAIL','Retail','retail'),
  ('RESELLER','Reseller','reseller'),
  ('VIP_RESELLER','VIP Reseller','vip_reseller')
on conflict (code) do nothing;

-- RLS is intentionally enabled later, after the admin authentication model is connected.
-- Do not expose the credentials tables directly from a browser client.
