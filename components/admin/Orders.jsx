'use client';
import { useState } from 'react';
import { brl, formatPhone, NEXT_ACTION, nextStatus, PAYMENTS, statusLabel, waLink } from '@/lib/store';
import { ConfirmButton } from '../ui';

export default function Orders({ sb, orders, menu, reloadOrders, toast }) {
  const [filter, setFilter] = useState('abertos');
  const [busy, setBusy] = useState(null);
  const [printing, setPrinting] = useState(null);

  const start = new Date(); start.setHours(0, 0, 0, 0);
  let list = orders;
  if (filter === 'abertos') list = list.filter((o) => !['concluido', 'cancelado'].includes(o.status));
  if (filter === 'hoje') list = list.filter((o) => new Date(o.created_at) >= start);

  const setStatus = async (o, status) => {
    setBusy(o.id);
    const { error } = await sb.from('lv_orders').update({ status }).eq('id', o.id);
    setBusy(null);
    if (error) return toast('Não foi possível atualizar o pedido.');
    toast(`Pedido #${o.number}: ${statusLabel({ ...o, status })}`);
    reloadOrders();
  };
  const print = (o) => {
    setPrinting(o);
    setTimeout(() => { window.print(); }, 60);
  };

  return (
    <div className="stack">
      <div className="pillset">
        {[['abertos', 'Em aberto'], ['hoje', 'Hoje'], ['todos', 'Todos']].map(([k, l]) => (
          <button key={k} className="pill" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      {list.length ? (
        <div className="orders">
          {list.slice(0, 150).map((o) => {
            const nx = nextStatus(o);
            const act = NEXT_ACTION[o.status];
            const label = typeof act === 'object' ? act[o.mode] : act;
            const a = o.address;
            const t = new Date(o.created_at);
            return (
              <article key={o.id} className={`order s-${o.status}`}>
                <div className="oh">
                  <b>#{o.number}</b>
                  <span className={`status ${o.status}`}>{statusLabel(o)}</span>
                  <span className="muted num" style={{ marginLeft: 'auto', fontSize: 13 }}>
                    {t.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} {t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="ob">
                  <div>
                    <span className="mode">{o.mode === 'entrega' ? 'Entrega' : 'Retirada'}</span><br />
                    <b>{o.customer_name}</b> · <span className="num">{formatPhone(o.customer_phone)}</span>
                  </div>
                  {a ? (
                    <div>
                      {a.street}, {a.number} · {a.district}{a.complement ? ` · ${a.complement}` : ''}
                      {a.reference ? <><br /><small className="muted">Ref.: {a.reference}</small></> : null}
                    </div>
                  ) : null}
                  <div>
                    {o.items.map((i, n) => (
                      <div key={n}>
                        <b>{i.qty}x</b> {i.name}
                        {i.options?.length ? <><br /><small className="muted">+ {i.options.map((x) => x.name).join(', ')}</small></> : null}
                        {i.note ? <><br /><small style={{ color: 'var(--warn)' }}>Obs.: {i.note}</small></> : null}
                      </div>
                    ))}
                  </div>
                  <div className="line">
                    <span>{PAYMENTS[o.payment_method]}{o.change_for ? ` · troco p/ ${brl(o.change_for)}` : ''}</span>
                    <b className="num">{brl(o.total)}</b>
                  </div>
                </div>
                <div className="of">
                  {nx ? <button className="btn primary sm" disabled={busy === o.id} onClick={() => setStatus(o, nx)}>{label}</button> : null}
                  <button className="btn sm" onClick={() => print(o)}>Imprimir</button>
                  {waLink(o.customer_phone) ? (
                    <a className="btn sm" href={waLink(o.customer_phone, `Olá ${o.customer_name}! Sobre seu pedido #${o.number} na ${menu.store?.name || ''}:`)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                  ) : null}
                  {!['concluido', 'cancelado'].includes(o.status) ? (
                    <ConfirmButton className="btn ghost sm danger" onConfirm={() => setStatus(o, 'cancelado')}>Cancelar</ConfirmButton>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card empty">
          Nenhum pedido {filter === 'abertos' ? 'em aberto' : filter === 'hoje' ? 'hoje' : 'registrado'}. Os novos pedidos aparecem aqui na hora.
        </div>
      )}
      {printing ? <Receipt order={printing} store={menu.store} /> : null}
    </div>
  );
}

function Receipt({ order: o, store }) {
  const a = o.address;
  return (
    <div className="print-area" aria-hidden="true">
      <h2>{store?.name}</h2>
      <div style={{ textAlign: 'center' }}>PEDIDO #{o.number} · {o.mode === 'entrega' ? 'ENTREGA' : 'RETIRADA'}</div>
      <div style={{ textAlign: 'center' }}>{new Date(o.created_at).toLocaleString('pt-BR')}</div>
      <hr />
      {o.items.map((i, n) => (
        <div key={n} style={{ marginBottom: 4 }}>
          <div className="pl"><b>{i.qty}x {i.name}</b><span>{brl(i.unit_price * i.qty)}</span></div>
          {i.options?.length ? <div>+ {i.options.map((x) => x.name).join(', ')}</div> : null}
          {i.note ? <div>OBS: {i.note}</div> : null}
        </div>
      ))}
      <hr />
      <div className="pl"><span>Subtotal</span><span>{brl(o.subtotal)}</span></div>
      {o.mode === 'entrega' ? <div className="pl"><span>Entrega</span><span>{brl(o.delivery_fee)}</span></div> : null}
      <div className="pl"><b>TOTAL</b><b>{brl(o.total)}</b></div>
      <div>Pagamento: {PAYMENTS[o.payment_method]}{o.change_for ? ` (troco p/ ${brl(o.change_for)})` : ''}</div>
      <hr />
      <div>{o.customer_name} · {formatPhone(o.customer_phone)}</div>
      {a ? <div>{a.street}, {a.number} · {a.district}{a.complement ? ` · ${a.complement}` : ''}{a.reference ? ` · Ref: ${a.reference}` : ''}</div> : null}
    </div>
  );
}
