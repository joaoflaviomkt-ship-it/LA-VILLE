'use client';
import { useMemo, useState } from 'react';
import { brl, formatPhone, phoneDigits, waLink } from '@/lib/store';
import { ConfirmButton, Sheet } from '../ui';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '·');
const D30 = 30 * 864e5;

export default function Customers({ sb, orders, customers, reloadCustomers, toast }) {
  const [filter, setFilter] = useState('todos');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('last');
  const [editing, setEditing] = useState(null); // customer row | {} (novo)

  const list = useMemo(() => {
    const byId = new Map(customers.map((c) => [c.id, { ...c, orders: [], spent: 0, count: 0, last: 0, items: {} }]));
    const byPhone = new Map([...byId.values()].map((c) => [c.phone, c]));
    for (const o of orders) {
      const c = (o.customer_id && byId.get(o.customer_id)) || byPhone.get(phoneDigits(o.customer_phone));
      if (!c) continue;
      c.orders.push(o);
      const t = new Date(o.created_at).getTime();
      if (t > c.last) c.last = t;
      if (o.status !== 'cancelado') {
        c.count++; c.spent += o.total;
        o.items.forEach((i) => { c.items[i.name] = (c.items[i.name] || 0) + i.qty; });
      }
    }
    return [...byId.values()].map((c) => ({
      ...c,
      first: new Date(c.created_at).getTime(),
      fav: Object.entries(c.items).sort((a, b) => b[1] - a[1])[0]?.[0] || '',
    }));
  }, [customers, orders]);

  const now = Date.now(), month = new Date().getMonth() + 1;
  const isNew = (c) => now - c.first < D30;
  const isRec = (c) => c.count >= 2;
  const isGone = (c) => c.count >= 1 && now - c.last > D30;
  const isBday = (c) => c.birthday && Number(c.birthday.split('-')[1]) === month;
  const F = { todos: () => true, recorrentes: isRec, novos: isNew, sumidos: isGone, aniversario: isBday };
  const term = q.trim().toLowerCase(), qd = term.replace(/\D/g, '');
  const shown = list
    .filter(F[filter])
    .filter((c) => !term || c.name.toLowerCase().includes(term) || (qd && c.phone.includes(qd)) || c.district.toLowerCase().includes(term) || c.tags.toLowerCase().includes(term))
    .sort({
      last: (a, b) => b.last - a.last || b.first - a.first,
      spent: (a, b) => b.spent - a.spent,
      count: (a, b) => b.count - a.count,
      name: (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
    }[sort]);
  const rec = list.filter(isRec).length;

  const exportCsv = () => {
    const esc = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
    const rows = [['Nome', 'WhatsApp', 'Rua', 'Número', 'Bairro', 'Complemento', 'Referência', 'Aniversário', 'Etiquetas', 'Pedidos', 'Total gasto', 'Cliente desde', 'Último pedido', 'Mais pede', 'Observações']];
    list.forEach((c) => rows.push([c.name, formatPhone(c.phone), c.street, c.number, c.district, c.complement, c.reference, c.birthday ? fmtDate(c.birthday + 'T12:00') : '', c.tags, c.count, c.spent.toFixed(2).replace('.', ','), fmtDate(c.first), c.last ? fmtDate(c.last) : '', c.fav, c.notes]));
    const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `clientes-la-ville-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  return (
    <div className="stack">
      <div className="kpis">
        <div className="card kpi"><span className="lbl">Clientes</span><b className="num">{list.length}</b></div>
        <div className="card kpi"><span className="lbl">Novos em 30 dias</span><b className="num">{list.filter(isNew).length}</b></div>
        <div className="card kpi"><span className="lbl">Recorrentes</span><b className="num">{rec}{list.length ? <small className="muted" style={{ fontSize: 14 }}> {Math.round((rec / list.length) * 100)}%</small> : null}</b></div>
        <div className="card kpi"><span className="lbl">Sumidos há 30+ dias</span><b className="num">{list.filter(isGone).length}</b></div>
      </div>
      <div className="pillset">
        <button className="btn primary" onClick={() => setEditing({})}>+ Novo cliente</button>
        <button className="btn" onClick={exportCsv} disabled={!list.length}>Exportar planilha</button>
        <span style={{ flex: 1 }} />
        <input className="input" style={{ maxWidth: 320 }} type="search" placeholder="Buscar nome, telefone, bairro ou etiqueta" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar clientes" />
        <select className="input" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenar">
          <option value="last">Último pedido</option><option value="spent">Mais gastou</option><option value="count">Mais pedidos</option><option value="name">Nome</option>
        </select>
      </div>
      <div className="pillset">
        {[['todos', 'Todos'], ['recorrentes', 'Recorrentes'], ['novos', 'Novos (30 dias)'], ['sumidos', 'Sumidos há 30+ dias'], ['aniversario', 'Aniversariantes do mês']].map(([k, l]) => (
          <button key={k} className="pill" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      {shown.length ? (
        <div className="card tablewrap" style={{ padding: '4px 8px' }}>
          <table>
            <thead><tr><th>Cliente</th><th>WhatsApp</th><th>Bairro</th><th className="r">Pedidos</th><th className="r">Total gasto</th><th>Último pedido</th><th /></tr></thead>
            <tbody>
              {shown.slice(0, 500).map((c) => (
                <tr key={c.id}>
                  <td>
                    <b>{c.name || 'Sem nome'}</b>
                    {c.tags ? <div>{c.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => <span key={t} className="tag" style={{ margin: '2px 4px 0 0' }}>{t}</span>)}</div> : null}
                  </td>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>{formatPhone(c.phone)}</td>
                  <td>{c.district || '·'}</td>
                  <td className="r num">{c.count}</td>
                  <td className="r num">{brl(c.spent)}</td>
                  <td className="num">{c.last ? fmtDate(c.last) : <span className="muted">Nunca pediu</span>}</td>
                  <td className="r"><button className="btn sm" onClick={() => setEditing(c)}>Abrir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card empty">{list.length ? 'Nenhum cliente encontrado com esse filtro.' : 'Nenhum cliente ainda. Cada pedido pelo cardápio cadastra o cliente automaticamente.'}</div>
      )}
      <small className="muted">Clientes entram automaticamente ao fazer um pedido (identificados pelo WhatsApp).</small>
      {editing ? <CustomerSheet c={editing} sb={sb} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reloadCustomers(); }} toast={toast} /> : null}
    </div>
  );
}

function CustomerSheet({ c, sb, onClose, onSaved, toast }) {
  const isNew = !c.id;
  const [f, setF] = useState({
    name: c.name || '', phone: c.phone ? formatPhone(c.phone) : '', birthday: c.birthday || '', tags: c.tags || '',
    street: c.street || '', number: c.number || '', district: c.district || '', complement: c.complement || '', reference: c.reference || '', notes: c.notes || '',
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const hist = (c.orders || []).slice(0, 10);

  const save = async () => {
    const phone = phoneDigits(f.phone);
    if (!f.name.trim()) return setError('Informe o nome do cliente.');
    if (phone.length < 10) return setError('Informe um WhatsApp com DDD.');
    const row = { ...f, name: f.name.trim(), phone, birthday: f.birthday || null };
    const { error } = isNew ? await sb.from('lv_customers').insert(row) : await sb.from('lv_customers').update(row).eq('id', c.id);
    if (error) return setError(error.code === '23505' ? 'Já existe um cliente com esse WhatsApp.' : 'Não foi possível salvar.');
    toast('Cliente salvo');
    onSaved();
  };
  const remove = async () => {
    const { error } = await sb.from('lv_customers').delete().eq('id', c.id);
    if (error) return setError('Não foi possível apagar.');
    toast('Cadastro apagado. Os pedidos continuam no histórico.');
    onSaved();
  };

  return (
    <Sheet
      wide
      title={isNew ? 'Novo cliente' : c.name || 'Cliente'}
      onClose={onClose}
      footer={<>{!isNew ? <ConfirmButton onConfirm={remove}>Apagar cadastro</ConfirmButton> : null}<span style={{ flex: 1 }} /><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save}>Salvar</button></>}
    >
      {!isNew && c.orders?.length ? (
        <>
          <div className="kpis">
            <div className="box"><span className="lbl">Pedidos</span><b className="num">{c.count}</b></div>
            <div className="box"><span className="lbl">Total gasto</span><b className="num">{brl(c.spent)}</b></div>
            <div className="box"><span className="lbl">Ticket médio</span><b className="num">{brl(c.count ? c.spent / c.count : 0)}</b></div>
            <div className="box"><span className="lbl">Cliente desde</span><b className="num">{fmtDate(c.first)}</b></div>
          </div>
          {c.fav ? <small className="muted">Pede mais: <b>{c.fav}</b></small> : null}
        </>
      ) : null}
      {!isNew && waLink(c.phone) ? <a className="btn sm" style={{ justifySelf: 'start' }} href={waLink(c.phone, `Olá ${c.name}!`)} target="_blank" rel="noopener noreferrer">Chamar no WhatsApp</a> : null}
      <div className="grid2">
        <div className="field"><label htmlFor="c-name">Nome</label><input id="c-name" value={f.name} onChange={set('name')} maxLength={80} /></div>
        <div className="field"><label htmlFor="c-phone">WhatsApp</label><input id="c-phone" inputMode="tel" value={f.phone} onChange={set('phone')} /></div>
        <div className="field"><label htmlFor="c-bday">Aniversário</label><input id="c-bday" type="date" value={f.birthday} onChange={set('birthday')} /></div>
        <div className="field"><label htmlFor="c-tags">Etiquetas (separe por vírgula)</label><input id="c-tags" placeholder="Ex.: VIP, Beach tennis" value={f.tags} onChange={set('tags')} /></div>
        <div className="field span2"><label htmlFor="c-street">Rua</label><input id="c-street" value={f.street} onChange={set('street')} /></div>
        <div className="field"><label htmlFor="c-number">Número</label><input id="c-number" value={f.number} onChange={set('number')} /></div>
        <div className="field"><label htmlFor="c-district">Bairro</label><input id="c-district" value={f.district} onChange={set('district')} /></div>
        <div className="field"><label htmlFor="c-comp">Complemento</label><input id="c-comp" value={f.complement} onChange={set('complement')} /></div>
        <div className="field"><label htmlFor="c-ref">Referência</label><input id="c-ref" value={f.reference} onChange={set('reference')} /></div>
      </div>
      <div className="field"><label htmlFor="c-notes">Observações internas</label><textarea id="c-notes" maxLength={600} placeholder="Ex.: prefere sem cebola, cliente do beach tennis" value={f.notes} onChange={set('notes')} /></div>
      {hist.length ? (
        <div className="field">
          <span className="lbl">Últimos pedidos</span>
          {hist.map((o) => (
            <div key={o.id} className="line" style={{ fontSize: 14, borderBottom: '1px solid var(--line)', padding: '6px 0' }}>
              <span><b>#{o.number}</b> · {fmtDate(o.created_at)} · {o.items.map((i) => `${i.qty}x ${i.name}`).join(', ')}</span>
              <span className="num" style={{ whiteSpace: 'nowrap', textDecoration: o.status === 'cancelado' ? 'line-through' : 'none' }}>{brl(o.total)}</span>
            </div>
          ))}
        </div>
      ) : null}
      {error ? <div className="err" role="alert">{error}</div> : null}
    </Sheet>
  );
}
