import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase';
import { loadMenu } from '@/lib/menu';
import { priceOrder, OrderError } from '@/lib/order-logic';

export const dynamic = 'force-dynamic';

// Proteção simples contra envio repetido do mesmo aparelho.
const recent = new Map();
function tooFast(key) {
  const now = Date.now();
  const last = recent.get(key) || 0;
  recent.set(key, now);
  if (recent.size > 5000) recent.clear();
  return now - last < 8000;
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
  }
  if (body?.website) return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }); // campo-armadilha para robôs

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'local';
  if (tooFast(ip + ':' + String(body?.customer?.phone || ''))) {
    return NextResponse.json({ error: 'Aguarde alguns segundos antes de enviar outro pedido.' }, { status: 429 });
  }

  let sb;
  try {
    sb = supabaseService();
  } catch (e) {
    return NextResponse.json({ error: 'Sistema não configurado. Avise a loja.' }, { status: 500 });
  }

  try {
    const menu = await loadMenu(sb);
    const priced = priceOrder(body, menu);

    // Cadastra ou atualiza o cliente (identificado pelo WhatsApp)
    const customerRow = { phone: priced.customer_phone, name: priced.customer_name };
    if (priced.address) {
      Object.assign(customerRow, {
        street: priced.address.street, number: priced.address.number, district: priced.address.district,
        complement: priced.address.complement, reference: priced.address.reference,
      });
    }
    const { data: cust, error: custErr } = await sb
      .from('lv_customers')
      .upsert(customerRow, { onConflict: 'phone' })
      .select('id')
      .single();
    if (custErr) throw custErr;

    const { data: order, error } = await sb
      .from('lv_orders')
      .insert({ ...priced, customer_id: cust.id })
      .select('number, public_token, mode, customer_name, customer_phone, address, payment_method, change_for, items, subtotal, delivery_fee, total, created_at')
      .single();
    if (error) throw error;

    return NextResponse.json({ order: { ...order, token: order.public_token } });
  } catch (e) {
    if (e instanceof OrderError) return NextResponse.json({ error: e.message }, { status: 422 });
    console.error('Erro ao criar pedido', e);
    return NextResponse.json({ error: 'Não conseguimos registrar o pedido. Tente de novo ou chame a loja no WhatsApp.' }, { status: 500 });
  }
}
