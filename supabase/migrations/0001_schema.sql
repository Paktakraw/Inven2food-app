-- Inven2Food schema: tables, constraints, RLS, grants, helpers.

create function today_bkk() returns date
language sql stable
as $$ select (now() at time zone 'Asia/Bangkok')::date $$;

create function set_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

create table ingredients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  base_unit text not null check (base_unit in ('g', 'ml', 'piece')),
  default_zone text check (default_zone in ('freezer', 'fridge', 'dry')),
  reorder_point numeric(14,4) check (reorder_point >= 0),
  expiry_warn_days integer not null default 3 check (expiry_warn_days >= 0),
  default_shelf_life_days integer check (default_shelf_life_days > 0),
  archived boolean not null default false
);

create table purchase_units (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ingredient_id uuid not null references ingredients (id) on delete restrict,
  name text not null,
  factor numeric(14,4) not null check (factor > 0)
);

create table lots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ingredient_id uuid not null references ingredients (id) on delete restrict,
  qty_remaining numeric(14,4) not null check (qty_remaining >= 0),
  unit_cost numeric(18,8) not null check (unit_cost >= 0),
  purchased_on date not null default today_bkk(),
  expires_on date,
  zone text check (zone in ('freezer', 'fridge', 'dry'))
);

create table menus (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  archived boolean not null default false
);

create table recipe_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  menu_id uuid not null references menus (id) on delete restrict,
  ingredient_id uuid not null references ingredients (id) on delete restrict,
  qty numeric(14,4) not null check (qty > 0),
  yield_pct numeric(14,4) not null default 100 check (yield_pct > 0 and yield_pct <= 100)
);

create table cooking_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  menu_id uuid not null references menus (id) on delete restrict,
  qty numeric(14,4) not null check (qty > 0),
  note text,
  status text not null default 'done' check (status in ('done', 'cancelled')),
  total_cost numeric(18,8),
  made_at timestamptz not null default now()
);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lot_id uuid not null references lots (id) on delete restrict,
  qty_delta numeric(14,4) not null,
  reason text not null check (reason in ('opening', 'purchase', 'cook', 'cook_reversal', 'count_adjust', 'waste')),
  cooking_log_id uuid references cooking_logs (id) on delete restrict,
  unit_cost numeric(18,8) not null
);

create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ingredient_id uuid not null references ingredients (id) on delete restrict,
  planned_qty numeric(14,4) check (planned_qty > 0),
  source text not null default 'manual' check (source in ('manual', 'low_stock', 'planned_menu')),
  status text not null default 'planned' check (status in ('planned', 'checked_in')),
  purchase_unit_id uuid references purchase_units (id) on delete restrict,
  purchase_qty numeric(14,4) check (purchase_qty > 0),
  total_price numeric(18,8) check (total_price >= 0),
  expires_on date,
  zone text check (zone in ('freezer', 'fridge', 'dry'))
);

create index on purchase_units (ingredient_id);
create index on lots (ingredient_id);
create index on stock_movements (lot_id);
create index on stock_movements (cooking_log_id);
create index on recipe_items (menu_id);
create index on recipe_items (ingredient_id);
create index on cooking_logs (menu_id);
create index on shopping_items (ingredient_id);

-- updated_at triggers, RLS and policies
do $$
declare t text;
begin
  foreach t in array array['ingredients', 'purchase_units', 'lots', 'stock_movements',
                           'menus', 'recipe_items', 'cooking_logs', 'shopping_items']
  loop
    execute format('create trigger set_updated_at before update on %I
                    for each row execute function set_updated_at()', t);
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select to authenticated using (owner_id = auth.uid())',
                   t || '_select', t);
    execute format('create policy %I on %I for insert to authenticated with check (owner_id = auth.uid())',
                   t || '_insert', t);
    if t <> 'stock_movements' then
      execute format('create policy %I on %I for update to authenticated
                      using (owner_id = auth.uid()) with check (owner_id = auth.uid())',
                     t || '_update', t);
    end if;
    if t not in ('stock_movements', 'lots') then
      execute format('create policy %I on %I for delete to authenticated using (owner_id = auth.uid())',
                     t || '_delete', t);
    end if;
    execute format('revoke all on %I from anon', t);
  end loop;
end
$$;

-- Stock tables are written only through SECURITY DEFINER functions.
revoke insert, update, delete on lots, stock_movements from authenticated;
