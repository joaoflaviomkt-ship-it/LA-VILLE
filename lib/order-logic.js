// Validação e cálculo do pedido. Roda no SERVIDOR: os preços vêm do banco,
// nunca do navegador do cliente.
import { deliveryFeeFor, openInfo, paymentEnabled, phoneDigits, round2 } from './store.js';

const str = (v, max) => String(v ?? '').trim().slice(0, max);

export class OrderError extends Error {}

/**
 * @param input  corpo recebido do navegador
 * @param menu   { store, products, groups } lidos do banco
 * @param now    data atual (para teste)
 */
export function priceOrder(input, menu, now = new Date()) {
  const { store, products, groups } = menu;
  if (!store) throw new OrderError('Loja não configurada.');
  if (!openInfo(store, now).open) throw new OrderError('A loja está fechada agora. Tente no horário de funcionamento.');

  const mode = input?.mode === 'retirada' ? 'retirada' : input?.mode === 'entrega' ? 'entrega' : null;
  if (!mode) throw new OrderError('Escolha entrega ou retirada.');

  const name = str(input?.customer?.name, 80);
  const phone = phoneDigits(input?.customer?.phone);
  if (!name) throw new OrderError('Informe seu nome.');
  if (phone.length < 10 || phone.length > 11) throw new OrderError('Informe um WhatsApp válido com DDD.');

  let address = null;
  if (mode === 'entrega') {
    const a = input?.address || {};
    address = {
      street: str(a.street, 120), number: str(a.number, 20), district: str(a.district, 80),
      complement: str(a.complement, 80), reference: str(a.reference, 120),
    };
    if (!address.street || !address.number || !address.district)
      throw new OrderError('Preencha rua, número e bairro para a entrega.');
  }

  const method = input?.payment?.method;
  if (!paymentEnabled(store, method)) throw new OrderError('Forma de pagamento indisponível.');
  let changeFor = null;
  if (method === 'dinheiro' && input?.payment?.changeFor) {
    const n = Number(input.payment.changeFor);
    if (Number.isFinite(n) && n > 0 && n < 100000) changeFor = round2(n);
  }

  const rawItems = Array.isArray(input?.items) ? input.items : [];
  if (!rawItems.length) throw new OrderError('Sua sacola está vazia.');
  if (rawItems.length > 50) throw new OrderError('Pedido com itens demais.');

  const byId = new Map(products.map((p) => [p.id, p]));
  const groupById = new Map(groups.map((g) => [g.id, g]));

  const items = rawItems.map((it) => {
    const p = byId.get(it?.productId);
    if (!p || !p.active) throw new OrderError('Um item da sacola não está mais disponível. Remova e adicione de novo.');
    const qty = Math.floor(Number(it.qty));
    if (!(qty >= 1 && qty <= 50)) throw new OrderError(`Quantidade inválida para ${p.name}.`);
    const chosen = Array.isArray(it.optionIds) ? [...new Set(it.optionIds)] : [];
    const pGroups = (p.group_ids || []).map((id) => groupById.get(id)).filter(Boolean);
    const options = [];
    for (const g of pGroups) {
      const sel = g.options.filter((o) => chosen.includes(o.id));
      if (sel.length < g.min_select) throw new OrderError(`Escolha uma opção em “${g.name}” para ${p.name}.`);
      if (sel.length > g.max_select) throw new OrderError(`Máximo de ${g.max_select} em “${g.name}”.`);
      sel.forEach((o) => options.push({ id: o.id, name: o.name, price: round2(o.price) }));
    }
    if (options.length !== chosen.length) throw new OrderError(`Um adicional de ${p.name} mudou. Remova o item e adicione de novo.`);
    const unit = round2(Number(p.price) + options.reduce((a, o) => a + o.price, 0));
    return { product_id: p.id, name: p.name, qty, unit_price: unit, options, note: str(it.note, 140) };
  });

  const subtotal = round2(items.reduce((a, i) => a + i.unit_price * i.qty, 0));
  if (Number(store.min_order) > 0 && subtotal < Number(store.min_order))
    throw new OrderError(`O pedido mínimo é R$ ${Number(store.min_order).toFixed(2).replace('.', ',')}.`);
  const fee = deliveryFeeFor(store, mode, address?.district);
  if (fee === null) throw new OrderError('Ainda não entregamos nesse bairro.');

  return {
    mode, customer_name: name, customer_phone: phone, address,
    payment_method: method, change_for: changeFor, items,
    subtotal, delivery_fee: round2(fee), total: round2(subtotal + fee),
  };
}
