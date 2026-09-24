import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Status do pedido para o cliente acompanhar (sem dados pessoais).
export async function GET(_req, ctx) {
  const { token } = await ctx.params;
  if (!UUID.test(token || '')) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
  try {
    const sb = supabaseService();
    const [{ data: order, error }, { data: store }] = await Promise.all([
      sb.from('lv_orders')
        .select('number, status, mode, created_at, updated_at, items, subtotal, delivery_fee, total, payment_method')
        .eq('public_token', token)
        .maybeSingle(),
      sb.from('lv_store').select('name, whatsapp, address, maps_url, pix_key, prep_time').eq('id', 1).maybeSingle(),
    ]);
    if (error) throw error;
    if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
    return NextResponse.json({ order, store }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Não foi possível carregar o pedido.' }, { status: 500 });
  }
}
