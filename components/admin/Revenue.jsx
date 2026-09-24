'use client';
import { useState } from 'react';
import { brl, PAYMENTS } from '@/lib/store';

export default function Revenue({ orders }) {
  const [period, setPeriod] = useState(7);
  const valid = orders.filter((o) => o.status !== 'cancelado');
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (period - 1));
  const inP = period ? valid.filter((o) => new Date(o.created_at) >= start) : valid;

  const rev = inP.reduce((a, o) => a + o.total, 0);
  const cnt = inP.length;
  const itemsRev = inP.reduce((a, o) => a + o.subtotal, 0);
  const fees = inP.reduce((a, o) => a + o.delivery_fee, 0);
  const ent = inP.filter((o) => o.mode === 'entrega').length;
  const pay = {};
  inP.forEach((o) => { pay[o.payment_method] = (pay[o.payment_method] || 0) + o.total; });
  const tp = {};
  inP.forEach((o) => o.items.forEach((i) => {
    const t = (tp[i.name] ||= { q: 0, r: 0 });
    t.q += i.qty; t.r += i.qty * i.unit_price;
  }));
  const top = Object.entries(tp).sort((a, b) => b[1].q - a[1].q).slice(0, 10);

  const days = Math.max(period || 14, 7);
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d0 = new Date(); d0.setHours(0, 0, 0, 0); d0.setDate(d0.getDate() - i);
    const d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
    series.push({ d: d0, v: valid.filter((o) => { const t = new Date(o.created_at); return t >= d0 && t < d1; }).reduce((a, o) => a + o.total, 0) });
  }

  return (
    <div className="stack">
      <div className="pillset">
        {[[1, 'Hoje'], [7, '7 dias'], [30, '30 dias'], [0, 'Tudo']].map(([k, l]) => (
          <button key={k} className="pill" aria-pressed={period === k} onClick={() => setPeriod(k)}>{l}</button>
        ))}
      </div>
      <div className="kpis">
        <div className="card kpi"><span className="lbl">Faturamento</span><b className="num">{brl(rev)}</b></div>
        <div className="card kpi"><span className="lbl">Pedidos</span><b className="num">{cnt}</b></div>
        <div className="card kpi"><span className="lbl">Ticket médio</span><b className="num">{brl(cnt ? rev / cnt : 0)}</b></div>
        <div className="card kpi"><span className="lbl">Entrega / Retirada</span><b className="num">{ent} / {cnt - ent}</b></div>
      </div>
      <div className="cols">
        <div className="card chart">
          <div className="line" style={{ marginBottom: 8 }}><b>Faturamento por dia</b><small className="muted">últimos {days} dias</small></div>
          <BarChart series={series} />
        </div>
        <div className="card">
          <b>Por forma de pagamento</b>
          <table style={{ marginTop: 8 }}><tbody>
            {Object.keys(PAYMENTS).map((k) => <tr key={k}><td>{PAYMENTS[k]}</td><td className="r num">{brl(pay[k] || 0)}</td></tr>)}
            <tr><td className="muted">Produtos</td><td className="r num muted">{brl(itemsRev)}</td></tr>
            <tr><td className="muted">Taxas de entrega</td><td className="r num muted">{brl(fees)}</td></tr>
          </tbody></table>
        </div>
      </div>
      <div className="card">
        <b>Mais vendidos</b>
        {top.length ? (
          <div className="tablewrap"><table style={{ marginTop: 8 }}>
            <thead><tr><th>Produto</th><th className="r">Qtd.</th><th className="r">Receita</th></tr></thead>
            <tbody>{top.map(([n, t]) => <tr key={n}><td>{n}</td><td className="r num">{t.q}</td><td className="r num">{brl(t.r)}</td></tr>)}</tbody>
          </table></div>
        ) : <p className="muted">Sem vendas no período.</p>}
      </div>
      <small className="muted">Pedidos cancelados não entram no faturamento. Considera os últimos 2.000 pedidos.</small>
    </div>
  );
}

function niceStep(x) {
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const n = x / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function BarChart({ series }) {
  const W = 640, H = 220, pl = 58, pr = 8, pt = 12, pb = 26;
  const max = Math.max(...series.map((s) => s.v), 0);
  const step = niceStep(max / 3 || 50);
  const top = Math.max(step * Math.ceil(max / step), step);
  const iw = W - pl - pr, ih = H - pt - pb, bw = iw / series.length;
  const y = (v) => pt + ih - (v / top) * ih;
  const ticks = [];
  for (let t = 0; t <= top + 1e-6; t += step) ticks.push(t);
  const every = Math.ceil(series.length / 10);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Faturamento diário">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={pl - 6} y={y(t) + 4} textAnchor="end">{t >= 1000 ? `R$${(t / 1000).toLocaleString('pt-BR')}k` : `R$${t}`}</text>
        </g>
      ))}
      {series.map((s, i) => {
        const x = pl + i * bw + bw * 0.18, w = bw * 0.64;
        const h = s.v ? Math.max((s.v / top) * ih, 2) : 0;
        const last = i === series.length - 1;
        return (
          <g key={i}>
            <rect x={x} y={pt + ih - h} width={w} height={h} rx="3" fill={last ? 'var(--accent)' : 'var(--mustard)'}>
              <title>{`${s.d.toLocaleDateString('pt-BR')}: ${brl(s.v)}`}</title>
            </rect>
            {i % every === 0 || last ? <text x={x + w / 2} y={H - 8} textAnchor="middle">{`${s.d.getDate()}/${s.d.getMonth() + 1}`}</text> : null}
          </g>
        );
      })}
    </svg>
  );
}
