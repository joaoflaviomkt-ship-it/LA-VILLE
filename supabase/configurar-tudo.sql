-- =====================================================================
-- La Ville Burger · CONFIGURAÇÃO COMPLETA (banco + cardápio inicial)
-- Supabase > SQL Editor > New query > cole TUDO > Run.
-- Usa tabelas com prefixo lv_ : NÃO mexe nas tabelas do sistema antigo.
-- Pode rodar mais de uma vez sem duplicar nada.
-- =====================================================================
-- =====================================================================
-- La Ville Burger · Banco de dados (Supabase / Postgres)
-- Rode este arquivo inteiro no Supabase: SQL Editor > New query > Run.
-- Depois rode seed.sql para carregar o cardápio inicial.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Administradores (quem entra no /painel) ----------
create table if not exists public.lv_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.lv_is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.lv_admins where user_id = auth.uid());
$$;

-- ---------- updated_at automático ----------
create or replace function public.lv_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- Loja (uma linha só) ----------
create table if not exists public.lv_store (
  id              int primary key default 1 check (id = 1),
  name            text not null default 'La Ville Burger',
  description     text not null default '',
  whatsapp        text not null default '',
  prep_time       text not null default '',
  address         text not null default '',
  maps_url        text not null default '',
  status_override text not null default 'auto' check (status_override in ('auto','open','closed')),
  open_days       int[] not null default '{0,1,2,3,4,5,6}',   -- 0 = domingo ... 6 = sábado
  open_time       text not null default '17:00',
  close_time      text not null default '22:00',
  timezone        text not null default 'America/Fortaleza',  -- Teresina (UTC-3, sem horário de verão)
  delivery_fee    numeric(10,2) not null default 0 check (delivery_fee >= 0),
  delivery_area   text not null default '',
  districts       jsonb not null default '[]'::jsonb,          -- [{ "name": "Bairro", "fee": 8 }]
  min_order       numeric(10,2) not null default 0 check (min_order >= 0),
  pay_pix         boolean not null default true,
  pay_card        boolean not null default true,
  pay_cash        boolean not null default true,
  pix_key         text not null default '',
  logo_url        text,
  cover_url       text,
  cover_logo_url  text,                                        -- logo clara (PNG sem fundo) sobre a capa
  updated_at      timestamptz not null default now()
);
alter table public.lv_store add column if not exists cover_logo_url text;  -- para quem já rodou a versão anterior
drop trigger if exists lv_store_touch on public.lv_store;
create trigger lv_store_touch before update on public.lv_store for each row execute function public.lv_touch_updated_at();

-- ---------- Cardápio ----------
create table if not exists public.lv_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  position   int  not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.lv_products (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.lv_categories(id) on delete restrict,
  name        text not null,
  description text not null default '',
  price       numeric(10,2) not null check (price >= 0),
  active      boolean not null default true,
  featured    boolean not null default false,
  image_url   text,
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists lv_products_category_idx on public.lv_products(category_id);
drop trigger if exists lv_products_touch on public.lv_products;
create trigger lv_products_touch before update on public.lv_products for each row execute function public.lv_touch_updated_at();

create table if not exists public.lv_addon_groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  min_select int  not null default 0 check (min_select >= 0),
  max_select int  not null default 1 check (max_select >= 1),
  position   int  not null default 0,
  created_at timestamptz not null default now(),
  check (min_select <= max_select)
);

create table if not exists public.lv_addon_options (
  id       uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.lv_addon_groups(id) on delete cascade,
  name     text not null,
  price    numeric(10,2) not null default 0 check (price >= 0),
  position int not null default 0
);
create index if not exists lv_addon_options_group_idx on public.lv_addon_options(group_id);

create table if not exists public.lv_product_addon_groups (
  product_id uuid not null references public.lv_products(id) on delete cascade,
  group_id   uuid not null references public.lv_addon_groups(id) on delete cascade,
  position   int  not null default 0,
  primary key (product_id, group_id)
);

-- ---------- Clientes ----------
create table if not exists public.lv_customers (
  id         uuid primary key default gen_random_uuid(),
  phone      text not null unique,          -- só dígitos com DDD, ex.: 86995120634
  name       text not null default '',
  street     text not null default '',
  number     text not null default '',
  district   text not null default '',
  complement text not null default '',
  reference  text not null default '',
  birthday   date,
  tags       text not null default '',
  notes      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists lv_customers_touch on public.lv_customers;
create trigger lv_customers_touch before update on public.lv_customers for each row execute function public.lv_touch_updated_at();

-- ---------- Pedidos ----------
create table if not exists public.lv_orders (
  id             uuid primary key default gen_random_uuid(),
  number         bigint generated always as identity unique,
  public_token   uuid not null default gen_random_uuid() unique,  -- link de acompanhamento do cliente
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  status         text not null default 'novo'
                 check (status in ('novo','preparo','pronto','saiu','concluido','cancelado')),
  mode           text not null check (mode in ('entrega','retirada')),
  customer_id    uuid references public.lv_customers(id) on delete set null,
  customer_name  text not null,
  customer_phone text not null,
  address        jsonb,
  payment_method text not null check (payment_method in ('pix','cartao','dinheiro')),
  change_for     numeric(10,2),
  items          jsonb not null,   -- [{product_id,name,qty,unit_price,options:[{id,name,price}],note}]
  subtotal       numeric(10,2) not null,
  delivery_fee   numeric(10,2) not null default 0,
  total          numeric(10,2) not null
);
create index if not exists lv_orders_created_idx  on public.lv_orders(created_at desc);
create index if not exists lv_orders_customer_idx on public.lv_orders(customer_id);
drop trigger if exists lv_orders_touch on public.lv_orders;
create trigger lv_orders_touch before update on public.lv_orders for each row execute function public.lv_touch_updated_at();

-- =====================================================================
-- Segurança (Row Level Security)
--  · Qualquer pessoa LÊ loja e cardápio.
--  · Só administradores alteram cardápio/loja e veem clientes e pedidos.
--  · Pedidos são criados pelo servidor (rota /api/orders com a service key),
--    que recalcula todos os preços. O navegador do cliente nunca grava direto.
-- =====================================================================
alter table public.lv_admins               enable row level security;
alter table public.lv_store                enable row level security;
alter table public.lv_categories           enable row level security;
alter table public.lv_products             enable row level security;
alter table public.lv_addon_groups         enable row level security;
alter table public.lv_addon_options        enable row level security;
alter table public.lv_product_addon_groups enable row level security;
alter table public.lv_customers            enable row level security;
alter table public.lv_orders               enable row level security;

drop policy if exists "admin ve a si mesmo" on public.lv_admins;
create policy "admin ve a si mesmo" on public.lv_admins
  for select to authenticated using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['lv_store','lv_categories','lv_products','lv_addon_groups','lv_addon_options','lv_product_addon_groups'] loop
    execute format('drop policy if exists "leitura publica" on public.%I', t);
    execute format('create policy "leitura publica" on public.%I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "admin gerencia" on public.%I', t);
    execute format('create policy "admin gerencia" on public.%I for all to authenticated using (public.lv_is_admin()) with check (public.lv_is_admin())', t);
  end loop;
  foreach t in array array['lv_customers','lv_orders'] loop
    execute format('drop policy if exists "admin gerencia" on public.%I', t);
    execute format('create policy "admin gerencia" on public.%I for all to authenticated using (public.lv_is_admin()) with check (public.lv_is_admin())', t);
  end loop;
end $$;

-- =====================================================================
-- Fotos (Storage): bucket público "imagens"; só admin envia/apaga.
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('lv-imagens', 'lv-imagens', true)
on conflict (id) do nothing;

drop policy if exists "lv admin envia imagens" on storage.objects;
create policy "lv admin envia imagens" on storage.objects
  for insert to authenticated with check (bucket_id = 'lv-imagens' and public.lv_is_admin());
drop policy if exists "lv admin altera imagens" on storage.objects;
create policy "lv admin altera imagens" on storage.objects
  for update to authenticated using (bucket_id = 'lv-imagens' and public.lv_is_admin());
drop policy if exists "lv admin apaga imagens" on storage.objects;
create policy "lv admin apaga imagens" on storage.objects
  for delete to authenticated using (bucket_id = 'lv-imagens' and public.lv_is_admin());

-- =====================================================================
-- Tempo real: o painel recebe pedidos novos na hora.
-- =====================================================================
do $$
begin
  alter publication supabase_realtime add table public.lv_orders;
exception when duplicate_object then null;
end $$;

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

-- =====================================================================
-- ÚLTIMO PASSO (depois de criar o usuário em Authentication > Users):
-- troque o e-mail abaixo, tire os dois traços do começo das 2 linhas e rode.
-- =====================================================================
-- insert into public.lv_admins (user_id)
-- select id from auth.users where email = 'EMAIL-DO-DONO@gmail.com' on conflict do nothing;
