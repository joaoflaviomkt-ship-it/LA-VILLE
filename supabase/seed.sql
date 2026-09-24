-- =====================================================================
-- La Ville Burger · Dados iniciais (rode depois do schema.sql)
-- Pode rodar de novo: ele não duplica o que já existe.
-- =====================================================================

insert into public.lv_store (id, name, description, whatsapp, prep_time, address, maps_url,
  status_override, open_days, open_time, close_time, timezone,
  delivery_fee, delivery_area, districts, min_order,
  pay_pix, pay_card, pay_cash, pix_key, logo_url, cover_url, cover_logo_url)
values (1, 'La Ville Burger', 'Artesanal de verdade! Dentro do Espaço Físico Arena Esportiva.',
  '(86) 99512-0634', '40 a 60 min',
  'Av. Visconde da Parnaíba, 2780 · Horto Florestal, Teresina, PI',
  'https://maps.app.goo.gl/YakUW2ubFG9m2Kav5',
  'auto', '{0,1,2,3,4,5,6}', '17:00', '22:00', 'America/Fortaleza',
  15, 'Zona Leste', '[]'::jsonb, 20,
  true, true, true, '75122464391', '/img/logo.png', '/img/capa.jpg', '/img/logo-clara.png')
on conflict (id) do nothing;

insert into public.lv_categories (id, name, position) values
  ('11111111-0000-4000-8000-000000000001', 'Hambúrgueres', 1),
  ('11111111-0000-4000-8000-000000000002', 'Porções',      2),
  ('11111111-0000-4000-8000-000000000003', 'Bebidas',      3)
on conflict (id) do nothing;

insert into public.lv_addon_groups (id, name, min_select, max_select, position) values
  ('22222222-0000-4000-8000-000000000001', 'Tipo de pão', 1, 1, 1),
  ('22222222-0000-4000-8000-000000000002', 'Adicionais',  0, 5, 2),
  ('22222222-0000-4000-8000-000000000003', 'Sabor',       1, 1, 3)
on conflict (id) do nothing;

insert into public.lv_addon_options (id, group_id, name, price, position) values
  ('33333333-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000001', 'Pão de batata', 0, 1),
  ('33333333-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000001', 'Pão caseiro',   0, 2),
  ('33333333-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000002', 'Queijo',        2, 1),
  ('33333333-0000-4000-8000-000000000004', '22222222-0000-4000-8000-000000000002', 'Cheddar',       3, 2),
  ('33333333-0000-4000-8000-000000000005', '22222222-0000-4000-8000-000000000002', 'Ovo',           2, 3),
  ('33333333-0000-4000-8000-000000000006', '22222222-0000-4000-8000-000000000002', 'Bacon',         3, 4),
  ('33333333-0000-4000-8000-000000000007', '22222222-0000-4000-8000-000000000002', 'Blend 120g',    5, 5),
  ('33333333-0000-4000-8000-000000000008', '22222222-0000-4000-8000-000000000003', 'Coca-Cola',          0, 1),
  ('33333333-0000-4000-8000-000000000009', '22222222-0000-4000-8000-000000000003', 'Fanta Laranja',      0, 2),
  ('33333333-0000-4000-8000-000000000010', '22222222-0000-4000-8000-000000000003', 'Fanta Uva',          0, 3),
  ('33333333-0000-4000-8000-000000000011', '22222222-0000-4000-8000-000000000003', 'Guaraná Antarctica', 0, 4)
on conflict (id) do nothing;

insert into public.lv_products (id, category_id, name, description, price, active, featured, image_url, position) values
  ('44444444-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', 'Jacquim',
   'Pão, blend 120g de carne, queijo, alface, tomate, cebola caramelizada e molho especial.', 15.99, true, false, '/img/jacquim.jpg', 1),
  ('44444444-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001', 'Carosella',
   'Pão, blend 120g de carne, cheddar, alface, tomate, cebola caramelizada e molho especial.', 17.99, true, false, '/img/carosella.jpg', 2),
  ('44444444-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000001', 'Perrone',
   'Pão, blend 120g de carne, cheddar, bacon, cebola caramelizada e molho especial.', 20.99, true, true, '/img/perrone.jpg', 3),
  ('44444444-0000-4000-8000-000000000004', '11111111-0000-4000-8000-000000000001', 'Fogaça',
   'Pão, blend 120g de carne, queijo, bacon, ovo, alface, tomate, cebola caramelizada e molho especial.', 24.99, true, true, '/img/fogaca.jpg', 4),
  ('44444444-0000-4000-8000-000000000005', '11111111-0000-4000-8000-000000000001', 'Laville',
   'Pão, duplo blend 120g de carne, duplo cheddar, bacon, ovo, alface, tomate, cebola caramelizada e molho especial.', 28.99, true, true, '/img/laville.jpg', 5),
  ('44444444-0000-4000-8000-000000000006', '11111111-0000-4000-8000-000000000002', 'Batata simples',
   'Porção de batata frita crocante.', 19.99, true, true, '/img/batata.jpg', 1),
  ('44444444-0000-4000-8000-000000000007', '11111111-0000-4000-8000-000000000003', 'Refrigerante lata 350ml',
   'Coca-Cola, Fanta Laranja, Fanta Uva ou Guaraná Antarctica.', 6, true, false, null, 1),
  ('44444444-0000-4000-8000-000000000008', '11111111-0000-4000-8000-000000000003', 'Refrigerante 1L',
   'Coca-Cola, Fanta Laranja, Fanta Uva ou Guaraná Antarctica.', 10, true, false, null, 2)
on conflict (id) do nothing;

insert into public.lv_product_addon_groups (product_id, group_id, position)
select p.id, g.id, g.pos
from (values ('44444444-0000-4000-8000-000000000001'::uuid), ('44444444-0000-4000-8000-000000000002'::uuid),
             ('44444444-0000-4000-8000-000000000003'::uuid), ('44444444-0000-4000-8000-000000000004'::uuid),
             ('44444444-0000-4000-8000-000000000005'::uuid)) as p(id)
cross join (values ('22222222-0000-4000-8000-000000000001'::uuid, 1), ('22222222-0000-4000-8000-000000000002'::uuid, 2)) as g(id, pos)
on conflict do nothing;

insert into public.lv_product_addon_groups (product_id, group_id, position) values
  ('44444444-0000-4000-8000-000000000007', '22222222-0000-4000-8000-000000000003', 1),
  ('44444444-0000-4000-8000-000000000008', '22222222-0000-4000-8000-000000000003', 1)
on conflict do nothing;
