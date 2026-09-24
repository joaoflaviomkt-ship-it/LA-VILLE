'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { brl, FLOW, PAYMENTS, statusLabel, waLink } from '@/lib/store';

export default function OrderTracking() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/orders/${token}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Pedido não encontrado.');
        if (!stop) { setData(json); setError(''); }
      } catch (e) {
        if (!stop) setError(e.message);
      }
    };
    load();
    const t = setInterval(load, 15000);
    return () => { stop = true; clearInterval(t); };
  }, [token]);

  if (error && !data) {
    return <div className="wrap empty" style={{ paddingTop: 80 }}><h2>{error}</h2><p><a href="/">Voltar ao cardápio</a></p></div>;
  }
  if (!data) return <div className="wrap empty" style={{ paddingTop: 80 }}>Carregando pedido…</div>;

  const { order, store } = data;
  const flow = FLOW[order.mode] || [];
  const idx = flow.indexOf(order.status);
  const done = ['concluido', 'cancelado'].includes(order.status);

  return (
    <main className="wrap" style={{ paddingBlock: '32px 60px', display: 'grid', gap: 16 }}>
      <a href="/" className="btn ghost sm" style={{ justifySelf: 'start' }}>← Cardápio</a>
      <div className="card stack">
        <div className="line">
          <h1 style={{ fontSize: 28 }}>Pedido #{order.number}</h1>
          <span className={`status ${order.status}`}>{statusLabel(order)}</span>
        </div>
        <small className="muted">
          {new Date(order.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} ·{' '}
          {order.mode === 'entrega' ? 'Entrega' : 'Retirada'} · {PAYMENTS[order.payment_method]}
        </small>
        {order.status !== 'cancelado' ? (
          <div className="progress" style={{ gridTemplateColumns: `repeat(${flow.length}, 1fr)` }} aria-label="Progresso do pedido">
            {flow.map((s, i) => <span key={s} className={i <= idx ? 'on' : ''} />)}
          </div>
        ) : null}
        {!done ? <small className="muted">Esta página atualiza sozinha.{store?.prep_time ? ` Tempo estimado: ${store.prep_time}.` : ''}</small> : null}
        <div>
          {order.items.map((i, n) => (
            <div key={n} className="line" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
              <span>
                <b>{i.qty}x</b> {i.name}
                {i.options?.length ? <><br /><small className="muted">+ {i.options.map((o) => o.name).join(', ')}</small></> : null}
              </span>
              <span className="num">{brl(i.unit_price * i.qty)}</span>
            </div>
          ))}
        </div>
        {order.mode === 'entrega' ? <div className="line"><span>Entrega</span><span className="num">{brl(order.delivery_fee)}</span></div> : null}
        <div className="line total"><span>Total</span><span className="num">{brl(order.total)}</span></div>
        {order.payment_method === 'pix' && store?.pix_key ? (
          <div className="box"><span className="lbl">Chave Pix</span><b style={{ wordBreak: 'break-all' }}>{store.pix_key}</b></div>
        ) : null}
        {order.mode === 'retirada' && store?.address ? (
          <div className="box"><b>Retirada em</b><span>{store.address}</span>
            {store.maps_url ? <a className="btn sm" style={{ justifySelf: 'start' }} href={store.maps_url} target="_blank" rel="noopener noreferrer">Abrir no mapa</a> : null}
          </div>
        ) : null}
        {store?.whatsapp ? (
          <a className="btn block" href={waLink(store.whatsapp, `Olá! Sobre meu pedido #${order.number}:`)} target="_blank" rel="noopener noreferrer">Falar com a loja no WhatsApp</a>
        ) : null}
      </div>
    </main>
  );
}
