begin;
select plan(16);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.local'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.local');

-- Setup as user A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(auth.uid(), 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'auth.uid() returns user A');

insert into ingredients (id, name, base_unit)
values ('11111111-0000-0000-0000-000000000001', 'หมูสับ', 'g');

select is((select owner_id from ingredients), 'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 'owner_id defaults to auth.uid()');
select is((select expiry_warn_days from ingredients), 3, 'expiry_warn_days defaults to 3');

-- Constraints
select throws_ok(
  $$insert into ingredients (name, base_unit) values ('x', 'kg')$$,
  '23514', null, 'base_unit kg is rejected');

insert into menus (id, name) values ('22222222-0000-0000-0000-000000000001', 'ผัดกะเพรา');

select throws_ok(
  $$insert into recipe_items (menu_id, ingredient_id, qty, yield_pct)
    values ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 10, 0)$$,
  '23514', null, 'yield_pct = 0 is rejected');

select throws_ok(
  $$insert into lots (ingredient_id, qty_remaining, unit_cost, purchased_on)
    values ('11111111-0000-0000-0000-000000000001', 1, 1, current_date)$$,
  '42501', null, 'authenticated cannot insert into lots');

-- Create lot + movement as the privileged owner of the transaction
reset role;
insert into lots (id, owner_id, ingredient_id, qty_remaining, unit_cost, purchased_on)
values ('33333333-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        '11111111-0000-0000-0000-000000000001', 100, 0.5, current_date);
insert into stock_movements (id, owner_id, lot_id, qty_delta, reason, unit_cost)
values ('44444444-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        '33333333-0000-0000-0000-000000000001', 100, 'opening', 0.5);

select throws_ok(
  $$insert into lots (owner_id, ingredient_id, qty_remaining, unit_cost, purchased_on)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', -1, 1, current_date)$$,
  '23514', null, 'negative qty_remaining is rejected');

select throws_ok(
  $$delete from ingredients where id = '11111111-0000-0000-0000-000000000001'$$,
  '23503', null, 'cannot delete ingredient that has lots');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*)::int from lots), 1, 'user A sees own lot');
select throws_ok($$update lots set qty_remaining = 5$$, '42501', null, 'authenticated cannot update lots');
select throws_ok($$delete from lots$$, '42501', null, 'authenticated cannot delete lots');
select throws_ok($$update stock_movements set qty_delta = 1$$, '42501', null, 'authenticated cannot update stock_movements');
select throws_ok($$delete from stock_movements$$, '42501', null, 'authenticated cannot delete stock_movements');

-- User B isolation
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from ingredients), 0, 'user B cannot see user A ingredients');
select is((select count(*)::int from lots) + (select count(*)::int from stock_movements), 0, 'user B cannot see lots or movements');
select is(today_bkk(), (now() at time zone 'Asia/Bangkok')::date, 'today_bkk matches Bangkok date');

select * from finish();
rollback;
