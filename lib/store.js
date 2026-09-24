// Funções compartilhadas entre cardápio, painel e servidor.

export const brl = (n) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const PAYMENTS = { pix: 'Pix', cartao: 'Cartão', dinheiro: 'Dinheiro' };
export const paymentEnabled = (store, key) =>
  key === 'pix' ? !!store.pay_pix : key === 'cartao' ? !!store.pay_card : key === 'dinheiro' ? !!store.pay_cash : false;

export const FLOW = {
  entrega: ['novo', 'preparo', 'saiu', 'concluido'],
  retirada: ['novo', 'preparo', 'pronto', 'concluido'],
};
export const STATUS_LABEL = {
  novo: 'Recebido', preparo: 'Em preparo', pronto: 'Pronto para retirada',
  saiu: 'Saiu para entrega', concluido: 'Concluído', cancelado: 'Cancelado',
};
export const NEXT_ACTION = {
  novo: 'Iniciar preparo',
  preparo: { entrega: 'Saiu para entrega', retirada: 'Marcar pronto' },
  saiu: 'Marcar entregue',
  pronto: 'Marcar retirado',
};
export function statusLabel(o) {
  if (o.status === 'concluido') return o.mode === 'entrega' ? 'Entregue' : 'Retirado';
  return STATUS_LABEL[o.status] || o.status;
}
export function nextStatus(o) {
  const f = FLOW[o.mode] || [];
  const i = f.indexOf(o.status);
  return i >= 0 && i < f.length - 1 ? f[i + 1] : null;
}

// Dígitos do telefone, sem o 55 do Brasil (ex.: 86995120634)
export function phoneDigits(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return d;
}
export function formatPhone(p) {
  const d = phoneDigits(p);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p || '';
}
// Formata o telefone enquanto a pessoa digita: (86) 9 9999-9999
export function maskPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2), r = d.slice(2);
  if (d.length <= 6) return `(${ddd}) ${r}`;
  if (d.length <= 10) return `(${ddd}) ${r.slice(0, 4)}-${r.slice(4)}`;
  return `(${ddd}) ${r[0]} ${r.slice(1, 5)}-${r.slice(5)}`;
}
export function waLink(phone, text = '') {
  const d = phoneDigits(phone);
  if (d.length < 10) return '';
  return `https://wa.me/55${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

// Hora local da loja (Vercel roda em UTC; aqui convertemos pelo fuso da loja)
export function localNow(timezone = 'America/Fortaleza', date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { day, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}
const toMin = (s) => {
  const [h, m] = String(s || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
export function openInfo(store, date = new Date()) {
  if (!store) return { open: false, label: '' };
  if (store.status_override === 'open') return { open: true, label: 'Aberto agora' };
  if (store.status_override === 'closed') return { open: false, label: 'Fechado no momento' };
  const days = store.open_days || [];
  const isDay = (d) => days.includes(d);
  const { day, minutes } = localNow(store.timezone || 'America/Fortaleza', date);
  const o = toMin(store.open_time), c = toMin(store.close_time);
  const open = c > o
    ? isDay(day) && minutes >= o && minutes < c
    : (isDay(day) && minutes >= o) || (isDay((day + 6) % 7) && minutes < c); // vira a madrugada
  return {
    open,
    label: open ? `Aberto · até ${store.close_time}` : `Fechado · abre às ${store.open_time}`,
  };
}
export function hoursText(store) {
  const days = store.open_days || [];
  const all = [0, 1, 2, 3, 4, 5, 6].every((d) => days.includes(d));
  const list = all ? 'Todos os dias' : DAYS.filter((_, i) => days.includes(i)).join(', ');
  return `${list}, ${store.open_time} às ${store.close_time}`;
}

export function deliveryFeeFor(store, mode, district) {
  if (mode !== 'entrega') return 0;
  const list = Array.isArray(store.districts) ? store.districts : [];
  if (list.length) {
    const d = list.find((x) => x.name === district);
    return d ? Number(d.fee) || 0 : null; // null = bairro não atendido
  }
  return Number(store.delivery_fee) || 0;
}

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function buildWhatsMessage(order, store) {
  const L = [];
  L.push(`*Pedido #${order.number}* · ${store.name}`);
  L.push('');
  for (const i of order.items) {
    L.push(`${i.qty}x ${i.name} · ${brl(i.unit_price * i.qty)}`);
    if (i.options?.length) L.push(`   + ${i.options.map((o) => o.name).join(', ')}`);
    if (i.note) L.push(`   Obs.: ${i.note}`);
  }
  L.push('');
  L.push(`Subtotal: ${brl(order.subtotal)}`);
  if (order.mode === 'entrega') L.push(`Entrega: ${brl(order.delivery_fee)}`);
  L.push(`*Total: ${brl(order.total)}*`);
  L.push('');
  L.push(`Cliente: ${order.customer_name} · ${formatPhone(order.customer_phone)}`);
  if (order.mode === 'entrega' && order.address) {
    const a = order.address;
    L.push(`*Entrega:* ${a.street}, ${a.number} · ${a.district}${a.complement ? ` · ${a.complement}` : ''}`);
    if (a.reference) L.push(`Referência: ${a.reference}`);
  } else {
    L.push('*Retirada no local*');
  }
  L.push(`Pagamento: ${PAYMENTS[order.payment_method]}${order.change_for ? ` (troco para ${brl(order.change_for)})` : ''}`);
  return L.join('\n');
}

export function parseMoney(s) {
  const t = String(s ?? '').trim();
  if (!t) return 0;
  const n = /,/.test(t) ? parseFloat(t.replace(/\./g, '').replace(',', '.')) : parseFloat(t);
  return Number.isFinite(n) ? round2(n) : 0;
}
export const moneyInput = (n) => (Number(n) ? String(round2(n)).replace('.', ',') : '');
