-- =====================================================================
-- La Ville Burger · COMANDAS INDIVIDUAIS (com Pix por QR Code)
-- Supabase > SQL Editor > New query > cole TUDO > Run.
-- Rode DEPOIS do configurar-tudo.sql. Pode rodar mais de uma vez.
-- Não mexe em pedidos, cardápio nem clientes que já existem.
-- =====================================================================

-- ---------- Dados do Pix da loja (aparecem no app do banco de quem paga) ----------
alter table public.lv_store add column if not exists pix_name text not null default '';         -- vazio = usa o nome da loja
alter table public.lv_store add column if not exists pix_city text not null default 'Teresina';

-- ---------- Comandas ----------
create table if not exists public.lv_tabs (
  id             uuid primary key default gen_random_uuid(),
  number         bigint generated always as identity unique,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  closed_at      timestamptz,
  status         text not null default 'aberta' check (status in ('aberta','fechada','cancelada')),
  customer_id    uuid references public.lv_customers(id) on delete set null,
  customer_name  text not null,
  customer_phone text not null default '',            -- só dígitos com DDD
  notes          text not null default '',
  items          jsonb not null default '[]'::jsonb,  -- [{id,product_id,name,qty,unit_price,options:[{id,name,price}],note,added_at}]
  payments       jsonb not null default '[]'::jsonb,  -- [{id,method,amount,received,change,at}]
  discount       numeric(10,2) not null default 0 check (discount >= 0),
  subtotal       numeric(10,2) not null default 0,
  total          numeric(10,2) not null default 0,
  paid           numeric(10,2) not null default 0
);
create index if not exists lv_tabs_status_idx  on public.lv_tabs(status);
create index if not exists lv_tabs_created_idx on public.lv_tabs(created_at desc);
create index if not exists lv_tabs_phone_idx   on public.lv_tabs(customer_phone);

-- Totais sempre recalculados pelo banco (ninguém consegue gravar um total errado).
create or replace function public.lv_tabs_calc()
returns trigger language plpgsql as $$
declare
  v_sub numeric;
begin
  select coalesce(round(sum((e->>'qty')::numeric * (e->>'unit_price')::numeric), 2), 0)
    into v_sub from jsonb_array_elements(new.items) e;
  new.subtotal := v_sub;
  new.discount := least(greatest(coalesce(new.discount, 0), 0), v_sub);
  new.total    := round(v_sub - new.discount, 2);
  select coalesce(round(sum((e->>'amount')::numeric), 2), 0)
    into new.paid from jsonb_array_elements(new.payments) e;
  new.updated_at := now();
  if new.status = 'aberta' then
    new.closed_at := null;
  elsif tg_op = 'INSERT' or old.status is distinct from new.status then
    new.closed_at := now();
  end if;
  return new;
end $$;
drop trigger if exists lv_tabs_calc on public.lv_tabs;
create trigger lv_tabs_calc before insert or update on public.lv_tabs
  for each row execute function public.lv_tabs_calc();

-- ---------- Segurança: só administradores do painel ----------
alter table public.lv_tabs enable row level security;
drop policy if exists "admin gerencia" on public.lv_tabs;
create policy "admin gerencia" on public.lv_tabs
  for all to authenticated using (public.lv_is_admin()) with check (public.lv_is_admin());

create or replace function public.lv_tab_guard()
returns void language plpgsql stable as $$
begin
  if not public.lv_is_admin() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
end $$;

-- =====================================================================
-- Ações da comanda. Cada uma é uma operação só no banco, então dois
-- celulares mexendo na mesma comanda ao mesmo tempo não perdem nada.
-- =====================================================================

-- Abrir comanda (e cadastrar/atualizar o cliente pelo telefone)
create or replace function public.lv_tab_open(p_name text, p_phone text, p_notes text default '')
returns public.lv_tabs language plpgsql as $$
declare
  v_name  text := left(btrim(coalesce(p_name, '')), 80);
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_cust  uuid;
  r       public.lv_tabs;
begin
  perform public.lv_tab_guard();
  if v_name = '' then raise exception 'Informe o nome da pessoa.'; end if;
  if length(v_phone) > 11 and v_phone like '55%' then v_phone := substr(v_phone, 3); end if;
  if v_phone <> '' and length(v_phone) not in (10, 11) then raise exception 'Telefone inválido. Use DDD + número.'; end if;
  if v_phone <> '' then
    insert into public.lv_customers (phone, name) values (v_phone, v_name)
    on conflict (phone) do update set name = case when public.lv_customers.name = '' then excluded.name else public.lv_customers.name end
    returning id into v_cust;
  end if;
  insert into public.lv_tabs (customer_id, customer_name, customer_phone, notes)
  values (v_cust, v_name, v_phone, left(btrim(coalesce(p_notes, '')), 200))
  returning * into r;
  return r;
end $$;

-- Lançar item. Se já existir o mesmo produto com os mesmos adicionais e observação, só soma a quantidade.
create or replace function public.lv_tab_add_item(p_tab uuid, p_item jsonb)
returns public.lv_tabs language plpgsql as $$
declare
  v_qty   int     := coalesce((p_item->>'qty')::int, 1);
  v_price numeric := round(coalesce((p_item->>'unit_price')::numeric, -1), 2);
  v_name  text    := left(btrim(coalesce(p_item->>'name', '')), 80);
  v_note  text    := left(btrim(coalesce(p_item->>'note', '')), 140);
  v_opts  jsonb   := coalesce(p_item->'options', '[]'::jsonb);
  v_pid   text    := nullif(p_item->>'product_id', '');
  v_items jsonb;
  v_hit   text;
  r       public.lv_tabs;
begin
  perform public.lv_tab_guard();
  if v_name = '' then raise exception 'Item sem nome.'; end if;
  if v_qty < 1 or v_qty > 99 then raise exception 'Quantidade inválida.'; end if;
  if v_price < 0 or v_price > 100000 then raise exception 'Valor inválido.'; end if;
  if jsonb_typeof(v_opts) <> 'array' then v_opts := '[]'::jsonb; end if;

  select items into v_items from public.lv_tabs where id = p_tab and status = 'aberta' for update;
  if not found then raise exception 'Esta comanda não está aberta.'; end if;

  if v_pid is not null then
    select e->>'id' into v_hit from jsonb_array_elements(v_items) e
     where e->>'product_id' = v_pid and e->'options' = v_opts
       and coalesce(e->>'note', '') = v_note and (e->>'unit_price')::numeric = v_price
     limit 1;
  end if;

  if v_hit is not null then
    update public.lv_tabs set items = (
      select jsonb_agg(case when e->>'id' = v_hit
                            then jsonb_set(e, '{qty}', to_jsonb(least((e->>'qty')::int + v_qty, 99))) else e end order by n)
        from jsonb_array_elements(v_items) with ordinality as t(e, n))
     where id = p_tab returning * into r;
  else
    update public.lv_tabs set items = items || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text, 'product_id', v_pid, 'name', v_name, 'qty', v_qty,
      'unit_price', v_price, 'options', v_opts, 'note', v_note, 'added_at', now()))
     where id = p_tab returning * into r;
  end if;
  return r;
end $$;

-- Mudar quantidade de um item (0 = remover)
create or replace function public.lv_tab_set_qty(p_tab uuid, p_item text, p_qty int)
returns public.lv_tabs language plpgsql as $$
declare r public.lv_tabs;
begin
  perform public.lv_tab_guard();
  if p_qty < 0 or p_qty > 99 then raise exception 'Quantidade inválida.'; end if;
  update public.lv_tabs set items = coalesce((
      select jsonb_agg(case when e->>'id' = p_item then jsonb_set(e, '{qty}', to_jsonb(p_qty)) else e end order by n)
        from jsonb_array_elements(items) with ordinality as t(e, n)
       where not (e->>'id' = p_item and p_qty = 0)), '[]'::jsonb)
   where id = p_tab and status = 'aberta' returning * into r;
  if not found then raise exception 'Esta comanda não está aberta.'; end if;
  return r;
end $$;

-- Desconto em reais (nunca maior que o subtotal)
create or replace function public.lv_tab_set_discount(p_tab uuid, p_discount numeric)
returns public.lv_tabs language plpgsql as $$
declare r public.lv_tabs;
begin
  perform public.lv_tab_guard();
  if p_discount is null or p_discount < 0 then raise exception 'Desconto inválido.'; end if;
  update public.lv_tabs set discount = round(p_discount, 2)
   where id = p_tab and status = 'aberta' returning * into r;
  if not found then raise exception 'Esta comanda não está aberta.'; end if;
  return r;
end $$;

-- Registrar pagamento (pode dividir: parte no Pix, parte no dinheiro...)
create or replace function public.lv_tab_add_payment(p_tab uuid, p_method text, p_amount numeric, p_received numeric default null)
returns public.lv_tabs language plpgsql as $$
declare
  v_amount numeric := round(coalesce(p_amount, 0), 2);
  v_rec    numeric := case when p_received is null then null else round(p_received, 2) end;
  t        public.lv_tabs;
  r        public.lv_tabs;
begin
  perform public.lv_tab_guard();
  if p_method not in ('pix', 'cartao', 'dinheiro') then raise exception 'Forma de pagamento inválida.'; end if;
  select * into t from public.lv_tabs where id = p_tab and status = 'aberta' for update;
  if not found then raise exception 'Esta comanda não está aberta.'; end if;
  if v_amount <= 0 then raise exception 'Informe o valor pago.'; end if;
  if v_amount > round(t.total - t.paid, 2) + 0.009 then raise exception 'O valor é maior que o que falta pagar.'; end if;
  if p_method = 'dinheiro' and v_rec is not null and v_rec < v_amount then raise exception 'O valor recebido é menor que o valor pago.'; end if;
  update public.lv_tabs set payments = payments || jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text, 'method', p_method, 'amount', v_amount,
      'received', case when p_method = 'dinheiro' then coalesce(v_rec, v_amount) end,
      'change',   case when p_method = 'dinheiro' then coalesce(v_rec, v_amount) - v_amount end,
      'at', now()))
   where id = p_tab returning * into r;
  return r;
end $$;

-- Apagar um pagamento lançado errado
create or replace function public.lv_tab_remove_payment(p_tab uuid, p_payment text)
returns public.lv_tabs language plpgsql as $$
declare r public.lv_tabs;
begin
  perform public.lv_tab_guard();
  update public.lv_tabs set payments = coalesce((
      select jsonb_agg(e order by n) from jsonb_array_elements(payments) with ordinality as t(e, n)
       where e->>'id' <> p_payment), '[]'::jsonb)
   where id = p_tab and status = 'aberta' returning * into r;
  if not found then raise exception 'Esta comanda não está aberta.'; end if;
  return r;
end $$;

-- Fechar, cancelar ou reabrir
create or replace function public.lv_tab_set_status(p_tab uuid, p_status text)
returns public.lv_tabs language plpgsql as $$
declare t public.lv_tabs; r public.lv_tabs;
begin
  perform public.lv_tab_guard();
  select * into t from public.lv_tabs where id = p_tab for update;
  if not found then raise exception 'Comanda não encontrada.'; end if;
  if p_status = 'fechada' then
    if t.status <> 'aberta' then raise exception 'Só dá para fechar uma comanda aberta.'; end if;
    if jsonb_array_length(t.items) = 0 then raise exception 'A comanda está vazia.'; end if;
    if round(t.total - t.paid, 2) > 0.009 then raise exception 'Ainda falta receber. Registre o pagamento antes de fechar.'; end if;
  elsif p_status = 'cancelada' then
    if t.status <> 'aberta' then raise exception 'Só dá para cancelar uma comanda aberta.'; end if;
    if jsonb_array_length(t.payments) > 0 then raise exception 'Esta comanda já tem pagamento. Apague os pagamentos antes de cancelar.'; end if;
  elsif p_status = 'aberta' then
    if t.status = 'aberta' then return t; end if;
  else
    raise exception 'Situação inválida.';
  end if;
  update public.lv_tabs set status = p_status where id = p_tab returning * into r;
  return r;
end $$;

-- Funções só para quem está logado (o painel). Visitantes do cardápio não chamam nada disso.
revoke all on function public.lv_tab_open(text, text, text)                    from public, anon;
revoke all on function public.lv_tab_add_item(uuid, jsonb)                     from public, anon;
revoke all on function public.lv_tab_set_qty(uuid, text, int)                  from public, anon;
revoke all on function public.lv_tab_set_discount(uuid, numeric)               from public, anon;
revoke all on function public.lv_tab_add_payment(uuid, text, numeric, numeric) from public, anon;
revoke all on function public.lv_tab_remove_payment(uuid, text)                from public, anon;
revoke all on function public.lv_tab_set_status(uuid, text)                    from public, anon;
grant execute on function public.lv_tab_open(text, text, text)                    to authenticated;
grant execute on function public.lv_tab_add_item(uuid, jsonb)                     to authenticated;
grant execute on function public.lv_tab_set_qty(uuid, text, int)                  to authenticated;
grant execute on function public.lv_tab_set_discount(uuid, numeric)               to authenticated;
grant execute on function public.lv_tab_add_payment(uuid, text, numeric, numeric) to authenticated;
grant execute on function public.lv_tab_remove_payment(uuid, text)                to authenticated;
grant execute on function public.lv_tab_set_status(uuid, text)                    to authenticated;

-- Tempo real: todos os aparelhos do painel veem a comanda mudar na hora.
do $$
begin
  alter publication supabase_realtime add table public.lv_tabs;
exception when duplicate_object then null;
end $$;
