'use client';
import { useEffect, useMemo, useState } from 'react';
import { brl, formatPhone, maskPhone, moneyInput, parseMoney, phoneDigits, round2, waLink } from '@/lib/store';
import { normalizePixKey, pixPayload } from '@/lib/pix';
import { qrDataUrl } from '@/lib/qrcode';
import { ConfirmButton, Sheet } from '../ui';

// Comandas individuais: o dono abre a comanda com nome e telefone, lança o que a pessoa
// consumiu e recebe no fim (Pix com QR Code do valor exato, dinheiro ou cartão).

const STATUS = { aberta: 'Aberta', fechada: 'Fechada', cancelada: 'Cancelada' };
const METODOS = [['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['cartao', 'Cartão']];
const NOME_METODO = Object.fromEntries(METODOS);

const falta = (t) => Math.max(0, round2(t.total - t.paid));
const hora = (d) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dataHora = (d) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const qtdItens = (t) => t.items.reduce((a, i) => a + Number(i.qty || 0), 0);
const inicioDoDia = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

function pixDaLoja(store, valor, numero) {
  const key = store?.pix_key || '';
  if (!normalizePixKey(key).key) return null;
  return pixPayload({
    key,
    name: store.pix_name || store.name,
    city: store.pix_city || 'Teresina',
    amount: valor,
    txid: `COMANDA${numero}`,
  });
}

async function copiar(texto, toast) {
  try {
    await navigator.clipboard.writeText(texto);
    toast('Código Pix copiado');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = texto;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('Código Pix copiado'); } catch { toast('Não deu para copiar. Selecione o código e copie.'); }
    ta.remove();
  }
}

function resumoWhats(t, store, pix) {
  const L = [`*Comanda #${t.number}* · ${store?.name || ''}`, ''];
  for (const i of t.items) {
    L.push(`${i.qty}x ${i.name} · ${brl(i.unit_price * i.qty)}`);
    if (i.options?.length) L.push(`   + ${i.options.map((o) => o.name).join(', ')}`);
  }
  L.push('');
  if (t.discount > 0) L.push(`Desconto: -${brl(t.discount)}`);
  L.push(`Total: ${brl(t.total)}`);
  if (t.paid > 0) L.push(`Pago: ${brl(t.paid)}`);
  L.push(`*Falta pagar: ${brl(falta(t))}*`);
  if (pix && falta(t) > 0) {
    L.push('', 'Pix copia e cola (o valor já vem preenchido):', pix);
  }
  return L.join('\n');
}

export default function Comandas({ sb, menu, tabs, tabsError, patchTab, customers, toast }) {
  const [filtro, setFiltro] = useState('abertas');
  const [busca, setBusca] = useState('');
  const [novaAberta, setNovaAberta] = useState(false);
  const [abertaId, setAbertaId] = useState(null);
  const [imprimindo, setImprimindo] = useState(null);

  const rpc = async (fn, args, okMsg) => {
    const { data, error } = await sb.rpc(fn, args);
    if (error) { toast(error.message || 'Não foi possível salvar. Tente de novo.'); return null; }
    if (data) patchTab(data);
    if (okMsg) toast(okMsg);
    return data;
  };

  if (tabsError) {
    return (
      <div className="card stack" style={{ maxWidth: 640 }}>
        <b>Falta um passo para usar as comandas</b>
        <p className="muted">
          Abra o Supabase, vá em <b>SQL Editor → New query</b>, cole todo o conteúdo do arquivo <code>supabase/comandas.sql</code> e clique em <b>Run</b>. Depois recarregue esta página.
        </p>
      </div>
    );
  }

  const hoje = inicioDoDia();
  const abertas = tabs.filter((t) => t.status === 'aberta');
  const recebidoHoje = round2(tabs.reduce((a, t) => a + (t.payments || []).filter((p) => new Date(p.at) >= hoje).reduce((s, p) => s + Number(p.amount), 0), 0));
  const aReceber = round2(abertas.reduce((a, t) => a + falta(t), 0));

  let lista = tabs;
  if (filtro === 'abertas') lista = abertas;
  if (filtro === 'fechadas') lista = tabs.filter((t) => t.status === 'fechada' && new Date(t.closed_at) >= hoje);
  const q = busca.trim().toLowerCase();
  if (q) {
    const dig = q.replace(/\D/g, '');
    lista = lista.filter((t) => t.customer_name.toLowerCase().includes(q) || (dig && t.customer_phone.includes(dig)) || String(t.number) === q.replace('#', ''));
  }

  const aberta = abertaId ? tabs.find((t) => t.id === abertaId) : null;

  const imprimir = (t) => {
    setImprimindo(t);
    setTimeout(() => window.print(), 80);
  };

  return (
    <div className="stack">
      <div className="kpis">
        <div className="card kpi"><span className="lbl">Comandas abertas</span><b className="num">{abertas.length}</b></div>
        <div className="card kpi"><span className="lbl">A receber</span><b className="num">{brl(aReceber)}</b></div>
        <div className="card kpi"><span className="lbl">Recebido hoje</span><b className="num">{brl(recebidoHoje)}</b></div>
        <div className="card kpi"><span className="lbl">Fechadas hoje</span><b className="num">{tabs.filter((t) => t.status === 'fechada' && new Date(t.closed_at) >= hoje).length}</b></div>
      </div>

      <div className="line" style={{ flexWrap: 'wrap' }}>
        <div className="pillset">
          {[['abertas', 'Abertas'], ['fechadas', 'Fechadas hoje'], ['todas', 'Todas']].map(([k, l]) => (
            <button key={k} className="pill" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{l}</button>
          ))}
        </div>
        <div className="pillset" style={{ flex: '1 1 260px', justifyContent: 'flex-end' }}>
          <input className="input" style={{ maxWidth: 260 }} placeholder="Buscar nome, telefone ou nº" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar comanda" />
          <button className="btn primary" onClick={() => setNovaAberta(true)}>+ Abrir comanda</button>
        </div>
      </div>

      {lista.length ? (
        <div className="orders">
          {lista.slice(0, 200).map((t) => (
            <article key={t.id} className={`order comanda c-${t.status}`}>
              <div className="oh">
                <b>#{t.number}</b>
                <span className={`status ${t.status}`}>{STATUS[t.status]}</span>
                <span className="muted num" style={{ marginLeft: 'auto', fontSize: 13 }}>{dataHora(t.created_at)}</span>
              </div>
              <button type="button" className="ob comanda-corpo" onClick={() => setAbertaId(t.id)}>
                <div>
                  <b>{t.customer_name}</b>{t.customer_phone ? <> · <span className="num">{formatPhone(t.customer_phone)}</span></> : null}
                  {t.notes ? <><br /><small className="muted">{t.notes}</small></> : null}
                </div>
                <div className="muted">{qtdItens(t) ? `${qtdItens(t)} ${qtdItens(t) === 1 ? 'item' : 'itens'}` : 'Nenhum item ainda'}</div>
                <div className="line">
                  <span>Total <b className="num">{brl(t.total)}</b></span>
                  {t.status === 'aberta' ? (
                    <span className={falta(t) > 0 ? 'falta' : 'quitada'}>{falta(t) > 0 ? `Falta ${brl(falta(t))}` : 'Pago'}</span>
                  ) : null}
                </div>
              </button>
              <div className="of">
                <button className="btn primary sm" onClick={() => setAbertaId(t.id)}>{t.status === 'aberta' ? 'Lançar / receber' : 'Ver'}</button>
                {waLink(t.customer_phone) ? (
                  <a className="btn sm" href={waLink(t.customer_phone, `Olá ${t.customer_name}!`)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card empty">
          {q ? 'Nenhuma comanda encontrada nessa busca.'
            : filtro === 'abertas' ? 'Nenhuma comanda aberta. Toque em “Abrir comanda” para começar.'
              : filtro === 'fechadas' ? 'Nenhuma comanda fechada hoje.' : 'Nenhuma comanda ainda.'}
        </div>
      )}

      {novaAberta ? (
        <NovaComanda
          customers={customers}
          onClose={() => setNovaAberta(false)}
          onCriar={async (dados) => {
            const t = await rpc('lv_tab_open', dados, 'Comanda aberta');
            if (t) { setNovaAberta(false); setAbertaId(t.id); }
          }}
        />
      ) : null}

      {aberta ? (
        <Detalhe
          key={aberta.id}
          t={aberta}
          menu={menu}
          rpc={rpc}
          toast={toast}
          onClose={() => setAbertaId(null)}
          onPrint={() => imprimir(aberta)}
        />
      ) : null}

      {imprimindo ? <Recibo t={tabs.find((x) => x.id === imprimindo.id) || imprimindo} store={menu.store} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------- abrir comanda
function NovaComanda({ customers, onClose, onCriar }) {
  const [nome, setNome] = useState('');
  const [fone, setFone] = useState('');
  const [obs, setObs] = useState('');
  const [enviando, setEnviando] = useState(false);
  const digitos = phoneDigits(fone);
  const conhecido = digitos.length >= 10 ? customers.find((c) => c.phone === digitos) : null;

  useEffect(() => {
    if (conhecido && !nome.trim() && conhecido.name) setNome(conhecido.name);
  }, [conhecido]); // eslint-disable-line react-hooks/exhaustive-deps

  const valido = nome.trim() && (digitos.length === 10 || digitos.length === 11);

  const enviar = async (e) => {
    e.preventDefault();
    if (!valido || enviando) return;
    setEnviando(true);
    await onCriar({ p_name: nome.trim(), p_phone: digitos, p_notes: obs.trim() });
    setEnviando(false);
  };

  return (
    <Sheet
      title="Abrir comanda"
      onClose={onClose}
      footer={<button className="btn primary block" form="nova-comanda" type="submit" disabled={!valido || enviando}>{enviando ? 'Abrindo…' : 'Abrir comanda'}</button>}
    >
      <form id="nova-comanda" className="stack" onSubmit={enviar} autoComplete="off">
        <div className="field">
          <label htmlFor="c-fone">Telefone (WhatsApp)</label>
          <input id="c-fone" inputMode="tel" placeholder="(86) 9 9999-9999" value={fone} onChange={(e) => setFone(maskPhone(e.target.value))} autoFocus />
          {conhecido ? <small className="ok-texto">Cliente já cadastrado: {conhecido.name}</small> : null}
        </div>
        <div className="field">
          <label htmlFor="c-nome">Nome</label>
          <input id="c-nome" placeholder="Nome da pessoa" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="c-obs">Observação (opcional)</label>
          <input id="c-obs" placeholder="Ex.: quadra 2, time azul" value={obs} onChange={(e) => setObs(e.target.value)} maxLength={200} />
        </div>
      </form>
    </Sheet>
  );
}

// ---------------------------------------------------------------- comanda aberta
function Detalhe({ t, menu, rpc, toast, onClose, onPrint }) {
  const aberta = t.status === 'aberta';
  const restante = falta(t);
  const [desconto, setDesconto] = useState(moneyInput(t.discount));
  useEffect(() => { setDesconto(moneyInput(t.discount)); }, [t.discount]);

  const pixResumo = useMemo(() => {
    try { return restante > 0 ? pixDaLoja(menu.store, restante, t.number) : null; } catch { return null; }
  }, [menu.store, restante, t.number]);

  const fechar = () => rpc('lv_tab_set_status', { p_tab: t.id, p_status: 'fechada' }, `Comanda #${t.number} fechada`).then((r) => { if (r) onClose(); });

  const rodape = aberta ? (
    <>
      <button className="btn" onClick={onPrint}>Imprimir</button>
      {!t.payments.length ? (
        <ConfirmButton className="btn ghost danger" confirmText="Cancelar mesmo?" onConfirm={() => rpc('lv_tab_set_status', { p_tab: t.id, p_status: 'cancelada' }, 'Comanda cancelada').then((r) => { if (r) onClose(); })}>
          Cancelar comanda
        </ConfirmButton>
      ) : null}
      <button className="btn primary" style={{ marginLeft: 'auto' }} disabled={restante > 0 || !t.items.length} onClick={fechar}
        title={restante > 0 ? 'Receba o valor que falta para poder fechar' : ''}>
        Fechar comanda
      </button>
    </>
  ) : (
    <>
      <button className="btn" onClick={onPrint}>Imprimir</button>
      <ConfirmButton className="btn" confirmText="Reabrir mesmo?" onConfirm={() => rpc('lv_tab_set_status', { p_tab: t.id, p_status: 'aberta' }, 'Comanda reaberta')}>Reabrir comanda</ConfirmButton>
    </>
  );

  return (
    <Sheet title={`Comanda #${t.number} · ${t.customer_name}`} onClose={onClose} wide footer={rodape}>
      <div className="line" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <span className={`status ${t.status}`}>{STATUS[t.status]}</span>{' '}
          <small className="muted">aberta às {hora(t.created_at)}{t.closed_at ? ` · ${t.status === 'cancelada' ? 'cancelada' : 'fechada'} às ${hora(t.closed_at)}` : ''}</small>
          <div style={{ marginTop: 6 }}>
            {t.customer_phone ? <span className="num">{formatPhone(t.customer_phone)}</span> : <span className="muted">Sem telefone</span>}
            {t.notes ? <> · <span className="muted">{t.notes}</span></> : null}
          </div>
        </div>
        {waLink(t.customer_phone) ? (
          <a className="btn sm" href={waLink(t.customer_phone, resumoWhats(t, menu.store, pixResumo))} target="_blank" rel="noopener noreferrer">
            Enviar conta no WhatsApp
          </a>
        ) : null}
      </div>

      {/* ---------- itens ---------- */}
      <section className="stack" style={{ gap: 0 }}>
        <span className="lbl">Consumo</span>
        {t.items.length ? t.items.map((i) => (
          <div className="citem comanda-item" key={i.id}>
            <div>
              <b>{aberta ? null : `${i.qty}x `}{i.name}</b>
              {i.options?.length ? <small>+ {i.options.map((o) => o.name).join(', ')}</small> : null}
              {i.note ? <small className="obs">Obs.: {i.note}</small> : null}
              <small className="num">{brl(i.unit_price)} cada · lançado às {hora(i.added_at)}</small>
            </div>
            <div className="comanda-item-dir">
              {aberta ? (
                <div className="stepper">
                  <button type="button" aria-label={`Tirar um ${i.name}`} onClick={() => rpc('lv_tab_set_qty', { p_tab: t.id, p_item: i.id, p_qty: i.qty - 1 }, i.qty === 1 ? 'Item removido' : null)}>−</button>
                  <span className="num">{i.qty}</span>
                  <button type="button" aria-label={`Mais um ${i.name}`} disabled={i.qty >= 99} onClick={() => rpc('lv_tab_set_qty', { p_tab: t.id, p_item: i.id, p_qty: i.qty + 1 })}>+</button>
                </div>
              ) : null}
              <b className="num">{brl(i.unit_price * i.qty)}</b>
            </div>
          </div>
        )) : <p className="muted" style={{ padding: '10px 0' }}>Nenhum item lançado ainda.</p>}
      </section>

      {aberta ? <Lancador t={t} menu={menu} rpc={rpc} /> : null}

      {/* ---------- totais ---------- */}
      <section className="card stack comanda-totais">
        <div className="line"><span>Subtotal</span><span className="num">{brl(t.subtotal)}</span></div>
        <div className="line">
          <span>Desconto</span>
          {aberta ? (
            <form className="pillset" onSubmit={(e) => { e.preventDefault(); rpc('lv_tab_set_discount', { p_tab: t.id, p_discount: parseMoney(desconto) }, 'Desconto aplicado'); }}>
              <input className="input num" style={{ width: 110 }} inputMode="decimal" placeholder="0,00" aria-label="Desconto em reais" value={desconto} onChange={(e) => setDesconto(e.target.value)} />
              <button className="btn sm" type="submit" disabled={parseMoney(desconto) === round2(t.discount)}>Aplicar</button>
            </form>
          ) : <span className="num">{t.discount > 0 ? `-${brl(t.discount)}` : brl(0)}</span>}
        </div>
        <div className="line total"><span>Total</span><span className="num">{brl(t.total)}</span></div>
        <div className="line"><span>Pago</span><span className="num">{brl(t.paid)}</span></div>
        <div className={`line falta-linha ${restante > 0 ? 'falta' : 'quitada'}`}>
          <span>{restante > 0 ? 'Falta pagar' : 'Tudo pago'}</span><b className="num">{brl(restante)}</b>
        </div>
      </section>

      {aberta && restante > 0 && t.items.length ? <Pagamento t={t} store={menu.store} rpc={rpc} toast={toast} /> : null}

      {/* ---------- pagamentos ---------- */}
      {t.payments.length ? (
        <section className="stack" style={{ gap: 0 }}>
          <span className="lbl">Pagamentos recebidos</span>
          {t.payments.map((p) => (
            <div className="citem" key={p.id}>
              <div>
                <b>{NOME_METODO[p.method] || p.method}</b>
                <small className="num">
                  {dataHora(p.at)}
                  {p.method === 'dinheiro' && Number(p.change) > 0 ? ` · recebeu ${brl(p.received)}, troco ${brl(p.change)}` : ''}
                </small>
              </div>
              <div className="comanda-item-dir">
                <b className="num">{brl(p.amount)}</b>
                {aberta ? (
                  <ConfirmButton className="btn ghost sm danger" confirmText="Apagar?" onConfirm={() => rpc('lv_tab_remove_payment', { p_tab: t.id, p_payment: p.id }, 'Pagamento apagado')}>
                    Apagar
                  </ConfirmButton>
                ) : null}
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </Sheet>
  );
}

// ---------------------------------------------------------------- lançar itens
function Lancador({ t, menu, rpc }) {
  const [cat, setCat] = useState('todas');
  const [busca, setBusca] = useState('');
  const [escolhendo, setEscolhendo] = useState(null);
  const [avulso, setAvulso] = useState({ nome: '', valor: '' });
  const [ocupado, setOcupado] = useState(false);

  const ativos = menu.products.filter((p) => p.active);
  const q = busca.trim().toLowerCase();
  const lista = ativos.filter((p) => (cat === 'todas' || p.category_id === cat) && (!q || p.name.toLowerCase().includes(q)));
  const cats = menu.categories.filter((c) => ativos.some((p) => p.category_id === c.id));

  const lancar = async (item, msg) => {
    setOcupado(true);
    const r = await rpc('lv_tab_add_item', { p_tab: t.id, p_item: item }, msg);
    setOcupado(false);
    return r;
  };

  const tocarProduto = (p) => {
    if ((p.group_ids || []).length) { setEscolhendo(p); return; }
    lancar({ product_id: p.id, name: p.name, qty: 1, unit_price: p.price, options: [], note: '' }, `+1 ${p.name}`);
  };

  if (escolhendo) {
    return (
      <EscolherOpcoes
        p={escolhendo}
        menu={menu}
        ocupado={ocupado}
        onCancel={() => setEscolhendo(null)}
        onAdd={async (item) => { const r = await lancar(item, `+${item.qty} ${item.name}`); if (r) setEscolhendo(null); }}
      />
    );
  }

  const valorAvulso = parseMoney(avulso.valor);
  return (
    <section className="card stack lancador">
      <div className="line"><b>Lançar item</b><small className="muted">Toque no produto para somar 1</small></div>
      <input className="input" placeholder="Buscar no cardápio" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar produto" />
      <div className="pillset">
        <button type="button" className="pill" aria-pressed={cat === 'todas'} onClick={() => setCat('todas')}>Todos</button>
        {cats.map((c) => <button type="button" key={c.id} className="pill" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</button>)}
      </div>
      <div className="produtos-grid">
        {lista.map((p) => (
          <button type="button" key={p.id} className="produto-btn" disabled={ocupado} onClick={() => tocarProduto(p)}>
            <span>{p.name}</span>
            <small className="num">{brl(p.price)}{(p.group_ids || []).length ? ' · opções' : ''}</small>
          </button>
        ))}
        {!lista.length ? <p className="muted">Nenhum produto encontrado.</p> : null}
      </div>
      <details className="avulso">
        <summary>Item fora do cardápio</summary>
        <form className="optrow" style={{ marginTop: 10 }} onSubmit={async (e) => {
          e.preventDefault();
          if (!avulso.nome.trim() || !(valorAvulso > 0)) return;
          const r = await lancar({ product_id: null, name: avulso.nome.trim(), qty: 1, unit_price: valorAvulso, options: [], note: '' }, `+1 ${avulso.nome.trim()}`);
          if (r) setAvulso({ nome: '', valor: '' });
        }}>
          <input className="input" placeholder="Ex.: Água 500ml" aria-label="Nome do item" value={avulso.nome} onChange={(e) => setAvulso({ ...avulso, nome: e.target.value })} maxLength={80} />
          <input className="input num" placeholder="0,00" inputMode="decimal" aria-label="Valor" value={avulso.valor} onChange={(e) => setAvulso({ ...avulso, valor: e.target.value })} />
          <button className="btn sm" type="submit" disabled={ocupado || !avulso.nome.trim() || !(valorAvulso > 0)}>Lançar</button>
        </form>
      </details>
    </section>
  );
}

function EscolherOpcoes({ p, menu, ocupado, onCancel, onAdd }) {
  const grupos = (p.group_ids || []).map((id) => menu.groups.find((g) => g.id === id)).filter(Boolean);
  const [sel, setSel] = useState({});
  const [qtd, setQtd] = useState(1);
  const [obs, setObs] = useState('');

  const escolhidas = grupos.flatMap((g) => g.options.filter((o) => (sel[g.id] || []).includes(o.id)));
  const faltando = grupos.find((g) => (sel[g.id] || []).length < g.min_select);
  const unit = round2(p.price + escolhidas.reduce((a, o) => a + o.price, 0));

  const tocar = (g, o) => {
    const atual = sel[g.id] || [];
    let novo;
    if (g.max_select === 1) novo = atual.includes(o.id) && g.min_select === 0 ? [] : [o.id];
    else if (atual.includes(o.id)) novo = atual.filter((x) => x !== o.id);
    else if (atual.length < g.max_select) novo = [...atual, o.id];
    else return;
    setSel({ ...sel, [g.id]: novo });
  };

  return (
    <section className="card stack lancador">
      <div className="line"><b>{p.name}</b><button type="button" className="btn ghost sm" onClick={onCancel}>Voltar</button></div>
      {grupos.map((g) => (
        <div key={g.id} className="stack" style={{ gap: 0 }}>
          <div className="line"><span className="lbl">{g.name}</span>
            <small className="muted">{g.min_select > 0 ? (g.max_select === 1 ? 'escolha 1' : `escolha de ${g.min_select} a ${g.max_select}`) : `opcional, até ${g.max_select}`}</small>
          </div>
          {g.options.map((o) => {
            const marcado = (sel[g.id] || []).includes(o.id);
            return (
              <label className="opt" key={o.id}>
                <input type={g.max_select === 1 ? 'radio' : 'checkbox'} name={`g-${g.id}`} checked={marcado} onChange={() => tocar(g, o)} onClick={() => { if (g.max_select === 1 && marcado && g.min_select === 0) tocar(g, o); }} />
                <span className="grow">{o.name}</span>
                {o.price ? <span className="num">+ {brl(o.price)}</span> : null}
              </label>
            );
          })}
        </div>
      ))}
      <div className="field">
        <label htmlFor="op-obs">Observação</label>
        <input id="op-obs" placeholder="Ex.: sem cebola" value={obs} onChange={(e) => setObs(e.target.value)} maxLength={140} />
      </div>
      <div className="line">
        <div className="stepper">
          <button type="button" aria-label="Menos" onClick={() => setQtd(Math.max(1, qtd - 1))}>−</button>
          <span className="num">{qtd}</span>
          <button type="button" aria-label="Mais" onClick={() => setQtd(Math.min(99, qtd + 1))}>+</button>
        </div>
        <button type="button" className="btn primary" disabled={!!faltando || ocupado}
          onClick={() => onAdd({ product_id: p.id, name: p.name, qty: qtd, unit_price: unit, options: escolhidas.map((o) => ({ id: o.id, name: o.name, price: o.price })), note: obs.trim() })}>
          {faltando ? `Escolha: ${faltando.name}` : `Lançar · ${brl(unit * qtd)}`}
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- receber
function Pagamento({ t, store, rpc, toast }) {
  const restante = falta(t);
  const [metodo, setMetodo] = useState('pix');
  const [valor, setValor] = useState(moneyInput(restante));
  const [recebido, setRecebido] = useState('');
  const [pix, setPix] = useState(null); // { payload, url, valor }
  const [ocupado, setOcupado] = useState(false);

  // quando o que falta muda (item lançado, outro pagamento), o valor sugerido acompanha
  useEffect(() => { setValor(moneyInput(restante)); setPix(null); }, [restante]);

  const v = parseMoney(valor);
  const valorOk = v > 0 && v <= restante + 0.009;
  const rec = parseMoney(recebido);
  const troco = metodo === 'dinheiro' && rec > v ? round2(rec - v) : 0;
  const temChave = !!normalizePixKey(store?.pix_key).key;

  const registrar = async (m, extra = {}) => {
    setOcupado(true);
    const r = await rpc('lv_tab_add_payment', { p_tab: t.id, p_method: m, p_amount: v, p_received: extra.recebido ?? null }, `${NOME_METODO[m]} de ${brl(v)} registrado`);
    setOcupado(false);
    if (r) { setPix(null); setRecebido(''); }
  };

  const gerarPix = () => {
    try {
      const payload = pixDaLoja(store, v, t.number);
      setPix({ payload, url: qrDataUrl(payload, { margin: 3 }), valor: v });
    } catch (e) {
      toast(e.message);
    }
  };

  return (
    <section className="card stack pagamento">
      <b>Receber</b>
      <div className="pillset">
        {METODOS.map(([k, l]) => (
          <button type="button" key={k} className="pill" aria-pressed={metodo === k} onClick={() => { setMetodo(k); setPix(null); }}>{l}</button>
        ))}
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="pg-valor">Valor a receber</label>
          <input id="pg-valor" className="num" inputMode="decimal" value={valor} onChange={(e) => { setValor(e.target.value); setPix(null); }} />
          <small className="muted">
            {v < restante - 0.009 && v > 0 ? `Pagamento parcial: depois ainda faltam ${brl(restante - v)}` : 'Para dividir a conta, coloque só a parte de cada um.'}
          </small>
        </div>
        {metodo === 'dinheiro' ? (
          <div className="field">
            <label htmlFor="pg-rec">Valor entregue pela pessoa</label>
            <input id="pg-rec" className="num" inputMode="decimal" placeholder="Opcional" value={recebido} onChange={(e) => setRecebido(e.target.value)} />
            {troco > 0 ? <small className="troco">Troco: <b className="num">{brl(troco)}</b></small> : null}
          </div>
        ) : null}
      </div>
      {!valorOk && valor ? <small className="err-texto">O valor precisa ser maior que zero e no máximo {brl(restante)}.</small> : null}

      {metodo === 'pix' ? (
        !temChave ? (
          <div className="notice">Cadastre a chave Pix da loja na aba <b>Loja → Entrega e pagamento</b> para gerar o QR Code.</div>
        ) : pix ? (
          <div className="pix-box">
            <img src={pix.url} alt={`QR Code Pix de ${brl(pix.valor)}`} width={240} height={240} />
            <div className="stack" style={{ gap: 8 }}>
              <div className="pix-valor num">{brl(pix.valor)}</div>
              <small className="muted">A pessoa abre o app do banco, escolhe <b>Pix → Ler QR Code</b> e o valor já aparece preenchido.</small>
              <button type="button" className="btn sm" onClick={() => copiar(pix.payload, toast)}>Copiar Pix copia e cola</button>
              {waLink(t.customer_phone) ? (
                <a className="btn sm" target="_blank" rel="noopener noreferrer"
                  href={waLink(t.customer_phone, `Olá ${t.customer_name}! Segue o Pix da sua comanda #${t.number} na ${store?.name || ''}: ${brl(pix.valor)}.\n\nPix copia e cola:\n${pix.payload}`)}>
                  Enviar Pix no WhatsApp
                </a>
              ) : null}
              <div className="notice" style={{ fontSize: 13 }}>Confira no app do banco se o Pix caiu antes de confirmar.</div>
              <button type="button" className="btn primary" disabled={ocupado} onClick={() => registrar('pix')}>Recebi o Pix de {brl(pix.valor)}</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn primary" disabled={!valorOk} onClick={gerarPix}>Gerar QR Code Pix de {brl(v)}</button>
        )
      ) : null}

      {metodo === 'dinheiro' ? (
        <button type="button" className="btn primary" disabled={!valorOk || ocupado || (recebido && rec < v)}
          onClick={() => registrar('dinheiro', { recebido: rec > 0 ? rec : v })}>
          Registrar {brl(v)} em dinheiro{troco > 0 ? ` (troco ${brl(troco)})` : ''}
        </button>
      ) : null}
      {metodo === 'cartao' ? (
        <button type="button" className="btn primary" disabled={!valorOk || ocupado} onClick={() => registrar('cartao')}>Registrar {brl(v)} no cartão</button>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------- impressão (80mm)
function Recibo({ t, store }) {
  const restante = falta(t);
  let pix = null;
  try { pix = restante > 0 ? pixDaLoja(store, restante, t.number) : null; } catch { pix = null; }
  return (
    <div className="print-area" aria-hidden="true">
      <h2>{store?.name}</h2>
      <div style={{ textAlign: 'center' }}>COMANDA #{t.number}</div>
      <div style={{ textAlign: 'center' }}>{t.customer_name}{t.customer_phone ? ` · ${formatPhone(t.customer_phone)}` : ''}</div>
      <div style={{ textAlign: 'center' }}>{new Date().toLocaleString('pt-BR')}</div>
      <hr />
      {t.items.map((i) => (
        <div key={i.id} style={{ marginBottom: 4 }}>
          <div className="pl"><b>{i.qty}x {i.name}</b><span>{brl(i.unit_price * i.qty)}</span></div>
          {i.options?.length ? <div>+ {i.options.map((x) => x.name).join(', ')}</div> : null}
          {i.note ? <div>OBS: {i.note}</div> : null}
        </div>
      ))}
      <hr />
      <div className="pl"><span>Subtotal</span><span>{brl(t.subtotal)}</span></div>
      {t.discount > 0 ? <div className="pl"><span>Desconto</span><span>-{brl(t.discount)}</span></div> : null}
      <div className="pl"><b>TOTAL</b><b>{brl(t.total)}</b></div>
      {t.payments.map((p) => <div className="pl" key={p.id}><span>Pago ({NOME_METODO[p.method]})</span><span>{brl(p.amount)}</span></div>)}
      <div className="pl"><b>{restante > 0 ? 'FALTA PAGAR' : 'PAGO'}</b><b>{brl(restante)}</b></div>
      {pix ? (
        <>
          <hr />
          <div style={{ textAlign: 'center' }}>PAGUE COM PIX (valor já incluso)</div>
          <img src={qrDataUrl(pix, { margin: 2 })} alt="" style={{ width: '46mm', height: '46mm', display: 'block', margin: '4px auto' }} />
        </>
      ) : null}
    </div>
  );
}
