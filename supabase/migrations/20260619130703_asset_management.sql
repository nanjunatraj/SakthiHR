-- 20260619130703_asset_management
-- (exported from the live Supabase migration history)

create table if not exists asset_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  description text,
  status text not null default 'Active',
  created_at timestamptz not null default now()
);

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  product_id text not null unique,
  category_id uuid references asset_categories(id) on delete set null,
  name text not null,
  make_model text,
  serial_number text,
  status text not null default 'Available' check (status = any (array['Available','Allocated','In Maintenance','Retired','Lost'])),
  condition text,
  purchase_date date,
  purchase_cost numeric,
  mobile_number text,
  allocated_to uuid references employees(id) on delete set null,
  allocated_on date,
  remarks text,
  specifications jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists assets_category_idx on assets(category_id);
create index if not exists assets_allocated_idx on assets(allocated_to);

create table if not exists asset_allocations (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references assets(id) on delete cascade,
  employee_id uuid references employees(id) on delete set null,
  action text not null check (action = any (array['Allocated','Returned'])),
  on_date date not null default current_date,
  remarks text,
  created_at timestamptz not null default now()
);

alter table asset_categories enable row level security;
alter table assets enable row level security;
alter table asset_allocations enable row level security;
drop policy if exists asset_categories_all on asset_categories;
drop policy if exists assets_all on assets;
drop policy if exists asset_allocations_all on asset_allocations;
create policy asset_categories_all on asset_categories for all to authenticated using (true) with check (true);
create policy assets_all on assets for all to authenticated using (true) with check (true);
create policy asset_allocations_all on asset_allocations for all to authenticated using (true) with check (true);
alter publication supabase_realtime add table asset_categories;
alter publication supabase_realtime add table assets;
alter publication supabase_realtime add table asset_allocations;

insert into asset_categories (name, code) values
 ('Laptops','LAP'), ('Data Cards','DTC'), ('Mobile Phone & Connection','MOB'),
 ('Peripherals','PRF'), ('Bike','BIK'), ('Cars','CAR'), ('Access Control Cards','ACC')
on conflict do nothing;
