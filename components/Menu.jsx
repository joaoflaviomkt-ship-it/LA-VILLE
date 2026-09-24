'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  brl, buildWhatsMessage, deliveryFeeFor, hoursText, openInfo, parseMoney, paymentEnabled,
  maskPhone, PAYMENTS, phoneDigits, round2, waLink,
} from '@/lib/store';
import { Photo, Sheet, storage, useToast } from './ui';

const newKey = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export default function Menu({ data }) {
  const { store, categories, products, groups } = data;
  const [q, setQ] = useState('');
  const [cart, setCart] = useState([]);
  const [sheet, setSheet] = useState(null); // {type:'product',product} | {type:'cart'} | {type:'checkout'} | {type:'success',order}
  const [tracking, setTracking] = useState([]);
  const [oi, setOi] = useState(null);
  const [activeCat, setActiveCat] = useState(null);
  const [toast, toastNode] = useToast();
  const loaded = useRef(false);

  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const groupsFor = (p) => (p.group_ids || []).map((id) => groupById.get(id)).filter(Boolean);
  const active = useMemo(() => products.filter((p) => p.active), [products]);

  // carrega sacola salva e remove itens que saíram do cardápio
  useEffect(() => {
    const ids = new Set(active.map((p) => p.id));
    setCart(storage.get('lv_cart', []).filter((i) => ids.has(i.productId)));
    setTracking(storage.get('lv_orders', []));
    loaded.current = true;
  }, [active]);
  useEffect(() => { if (loaded.current) storage.set('lv_cart', cart); }, [cart]);
  useEffect(() => {
    const tick = () => setOi(openInfo(store));
    tick();
    const t = setInterval(tick, 60000);
    return () => clearInterval(t);
  }, [store]);

  const term = q.trim().toLowerCase();
  const match = (p) => !term || `${p.name} ${p.description}`.toLowerCase().includes(term);
  const featured = active.filter((p) => p.featured);
  const sections = categories
    .map((c) => ({ cat: c, items: active.filter((p) => p.category_id === c.id && match(p)) }))
    .filter((s) => s.items.length);

  // categoria visível na rolagem
  useEffect(() => {
    const els = document.querySelectorAll('.section');
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActiveCat(e.target.id); }),
      { rootMargin: '-80px 0px -65% 0px' }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [term, sections.length]);

  const subtotal = round2(cart.reduce((a, i) => a + i.unit * i.qty, 0));
  const count = cart.reduce((a, i) => a + i.qty, 0);
  const areas = Array.isArray(store.districts) ? store.districts : [];
  const feeText = areas.length
    ? `Entrega a partir de ${brl(Math.min(...areas.map((d) => Number(d.fee) || 0)))}`
    : `Entrega${store.delivery_area ? ` ${store.delivery_area}` : ''} ${brl(store.delivery_fee)}`;
  const lastTracking = tracking[0];

  const goTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <>
      <div className={`cover ${store.cover_url ? '' : 'pattern'}`}>
        {store.cover_url ? <img src={store.cover_url} alt="" /> : null}
        {store.cover_logo_url ? <div className="cover-logo"><img src={store.cover_logo_url} alt={store.name} /></div> : null}
      </div>
      <div className="wrap">
        <header className="store">
          <div className={`logo ${store.logo_url ? 'wide' : ''}`}>
            {store.logo_url ? <img src={store.logo_url} alt={store.name} /> : 'LV'}
          </div>
          <h1>{store.name}</h1>
          <p className="desc">{store.description}</p>
          <div className="chips">
            {oi ? (
              <span className={`chip ${oi.open ? 'open' : 'closed'}`}><span className="dot" />{oi.label}</span>
            ) : null}
            <span className="chip">{hoursText(store)}</span>
            <span className="chip">{feeText} · Retirada grátis</span>
            {store.min_order > 0 ? <span className="chip">Pedido mín. {brl(store.min_order)}</span> : null}
            {store.prep_time ? <span className="chip">{store.prep_time}</span> : null}
            {store.address ? (
              store.maps_url
                ? <a className="chip" href={store.maps_url} target="_blank" rel="noopener noreferrer">📍 {store.address}</a>
                : <span className="chip">📍 {store.address}</span>
            ) : null}
          </div>
        </header>
        {oi && !oi.open ? (
          <div className="notice closed-banner" role="status">
            <b>{store.status_override === 'closed' ? 'Não estamos recebendo pedidos agora.' : 'Estamos fechados agora.'}</b>{' '}
            {store.status_override === 'closed'
              ? 'Volte mais tarde.'
              : `Abrimos às ${store.open_time}. Você já pode montar sua sacola e enviar quando abrirmos.`}
          </div>
        ) : null}
        {lastTracking ? (
          <a className="btn block" style={{ marginTop: 12 }} href={`/pedido/${lastTracking.token}`}>
            Acompanhar meu pedido #{lastTracking.number}
          </a>
        ) : null}
        <div className="search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input type="search" placeholder="Buscar no cardápio" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar no cardápio" />
        </div>
      </div>

      <nav className="cats" aria-label="Categorias">
        <div className="wrap"><div className="row">
          {!term && featured.length ? (
            <button className={activeCat === 'sec-dest' ? 'on' : ''} onClick={() => goTo('sec-dest')}>Destaques</button>
          ) : null}
          {sections.map((s) => (
            <button key={s.cat.id} className={activeCat === `sec-${s.cat.id}` ? 'on' : ''} onClick={() => goTo(`sec-${s.cat.id}`)}>{s.cat.name}</button>
          ))}
        </div></div>
      </nav>

      <main className="wrap">
        {!term && featured.length ? (
          <section className="section" id="sec-dest">
            <h2>Destaques</h2>
            <div className="feat">
              {featured.map((p) => (
                <button key={p.id} className="fcard" onClick={() => setSheet({ type: 'product', product: p })}>
                  <Photo src={p.image_url} />
                  <span className="t"><b>{p.name}</b><span className="price num">{brl(p.price)}</span></span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {sections.map((s) => (
          <section className="section" id={`sec-${s.cat.id}`} key={s.cat.id}>
            <h2>{s.cat.name}</h2>
            <div className="list">
              {s.items.map((p) => (
                <button key={p.id} className="item" onClick={() => setSheet({ type: 'product', product: p })}>
                  <span>
                    <h3>{p.name}</h3>
                    <p>{p.description}</p>
                    <span className="price num">{brl(p.price)}</span>
                  </span>
                  <Photo src={p.image_url} />
                </button>
              ))}
            </div>
          </section>
        ))}
        {!sections.length ? <div className="empty">Nenhum item encontrado{term ? ` para “${q}”` : ''}.</div> : null}
      </main>
      <footer className="footer">{store.name} · {store.address}</footer>

      {count ? (
        <div className="cartbar">
          <button onClick={() => setSheet({ type: 'cart' })}>
            <span className="count num">{count}</span><span className="grow">Ver sacola</span><span className="num">{brl(subtotal)}</span>
          </button>
        </div>
      ) : null}

      {sheet?.type === 'product' ? (
        <ProductSheet
          product={sheet.product}
          groups={groupsFor(sheet.product)}
          onClose={() => setSheet(null)}
          onAdd={(item) => { setCart((c) => [...c, item]); setSheet(null); toast(`${item.name} adicionado à sacola`); }}
        />
      ) : null}
      {sheet?.type === 'cart' ? (
        <CartSheet
          cart={cart} store={store} subtotal={subtotal} open={oi?.open}
          onQty={(key, d) => setCart((c) => c.map((i) => (i.key === key ? { ...i, qty: i.qty + d } : i)).filter((i) => i.qty > 0))}
          onClose={() => setSheet(null)}
          onNext={() => setSheet({ type: 'checkout' })}
        />
      ) : null}
      {sheet?.type === 'checkout' ? (
        <CheckoutSheet
          cart={cart} store={store} subtotal={subtotal} open={oi?.open}
          onBack={() => setSheet({ type: 'cart' })}
          onClose={() => setSheet(null)}
          onDone={(order) => {
            setCart([]);
            const list = [{ token: order.token, number: order.number }, ...tracking].slice(0, 10);
            setTracking(list);
            storage.set('lv_orders', list);
            setSheet({ type: 'success', order });
          }}
        />
      ) : null}
      {sheet?.type === 'success' ? (
        <SuccessSheet order={sheet.order} store={store} onClose={() => setSheet(null)} toast={toast} />
      ) : null}
      {toastNode}
    </>
  );
}

function ProductSheet({ product, groups, onClose, onAdd }) {
  const [sel, setSel] = useState({}); // groupId -> [optionId]
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const toggle = (g, o) => {
    setError('');
    setSel((s) => {
      const cur = s[g.id] || [];
      if (g.max_select === 1) return { ...s, [g.id]: cur[0] === o.id && g.min_select === 0 ? [] : [o.id] };
      if (cur.includes(o.id)) return { ...s, [g.id]: cur.filter((x) => x !== o.id) };
      if (cur.length >= g.max_select) { setError(`Máximo de ${g.max_select} em ${g.name}.`); return s; }
      return { ...s, [g.id]: [...cur, o.id] };
    });
  };
  const chosen = groups.flatMap((g) => g.options.filter((o) => (sel[g.id] || []).includes(o.id)));
  const unit = round2(product.price + chosen.reduce((a, o) => a + o.price, 0));

  const add = () => {
    for (const g of groups) {
      if ((sel[g.id] || []).length < g.min_select) { setError(`Escolha uma opção em “${g.name}”.`); return; }
    }
    onAdd({
      key: newKey(), productId: product.id, name: product.name, qty, unit,
      options: chosen.map((o) => ({ id: o.id, name: o.name, price: o.price })), note: note.trim(),
    });
  };

  return (
    <Sheet
      title={product.name}
      onClose={onClose}
      footer={
        <>
          <div className="stepper">
            <button onClick={() => setQty((n) => Math.max(1, n - 1))} aria-label="Menos">−</button>
            <span className="num">{qty}</span>
            <button onClick={() => setQty((n) => Math.min(50, n + 1))} aria-label="Mais">+</button>
          </div>
          <button className="btn primary" style={{ flex: 1 }} onClick={add}>
            Adicionar · <span className="num">{brl(unit * qty)}</span>
          </button>
        </>
      }
    >
      {product.image_url ? <Photo src={product.image_url} className="ph pimg" /> : null}
      <div>
        <p className="muted" style={{ margin: '0 0 6px' }}>{product.description}</p>
        <span className="price num" style={{ fontSize: 18 }}>{brl(product.price)}</span>
      </div>
      {groups.map((g) => (
        <div key={g.id}>
          <div className="group-h">
            <span>
              <b>{g.name}</b><br />
              <small className="muted">{g.max_select === 1 ? 'Escolha 1 opção' : `Escolha até ${g.max_select}`}</small>
            </span>
            {g.min_select > 0 ? <span className="req">Obrigatório</span> : null}
          </div>
          {g.options.map((o) => (
            <label className="opt" key={o.id}>
              <span className="grow">
                {o.name}
                {o.price ? <><br /><small className="muted num">+ {brl(o.price)}</small></> : null}
              </span>
              <input
                type={g.max_select === 1 ? 'radio' : 'checkbox'}
                name={`g-${g.id}`}
                checked={(sel[g.id] || []).includes(o.id)}
                onChange={() => toggle(g, o)}
                onClick={(e) => { if (g.max_select === 1 && g.min_select === 0 && (sel[g.id] || []).includes(o.id)) { e.preventDefault(); toggle(g, o); } }}
              />
            </label>
          ))}
        </div>
      ))}
      <div className="field">
        <label htmlFor="pm-note">Alguma observação?</label>
        <textarea id="pm-note" maxLength={140} placeholder="Ex.: sem cebola, molho à parte" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error ? <div className="err">{error}</div> : null}
    </Sheet>
  );
}

function CartSheet({ cart, store, subtotal, open, onQty, onClose, onNext }) {
  useEffect(() => { if (!cart.length) onClose(); }, [cart.length, onClose]);
  const below = store.min_order > 0 && subtotal < store.min_order;
  return (
    <Sheet
      title="Sua sacola"
      onClose={onClose}
      footer={<button className="btn primary block" onClick={onNext} disabled={below}>Continuar</button>}
    >
      {cart.map((i) => (
        <div className="citem" key={i.key}>
          <div>
            <b>{i.name}</b>
            {i.options.length ? <small>{i.options.map((o) => o.name).join(', ')}</small> : null}
            {i.note ? <small>Obs.: {i.note}</small> : null}
            <span className="price num">{brl(i.unit * i.qty)}</span>
          </div>
          <div className="stepper">
            <button onClick={() => onQty(i.key, -1)} aria-label={i.qty === 1 ? 'Remover' : 'Menos'}>{i.qty === 1 ? '×' : '−'}</button>
            <span className="num">{i.qty}</span>
            <button onClick={() => onQty(i.key, 1)} aria-label="Mais">+</button>
          </div>
        </div>
      ))}
      <button className="btn ghost sm" style={{ justifySelf: 'start' }} onClick={onClose}>+ Adicionar mais itens</button>
      <div className="line"><span>Subtotal</span><b className="num">{brl(subtotal)}</b></div>
      <small className="muted">
        {Array.isArray(store.districts) && store.districts.length
          ? `Entrega: taxa conforme o bairro (a partir de ${brl(Math.min(...store.districts.map((d) => Number(d.fee) || 0)))})`
          : `Entrega${store.delivery_area ? ` (${store.delivery_area})` : ''}: + ${brl(store.delivery_fee)}`}
        {' · '}Retirada no local: grátis
      </small>
      {open === false ? <div className="notice">A loja está fechada agora. Você poderá enviar o pedido a partir das {store.open_time}.</div> : null}
      {below ? <div className="notice">O pedido mínimo é {brl(store.min_order)}. Faltam {brl(store.min_order - subtotal)}.</div> : null}
    </Sheet>
  );
}

function CheckoutSheet({ cart, store, subtotal, open, onBack, onClose, onDone }) {
  const pays = Object.keys(PAYMENTS).filter((k) => paymentEnabled(store, k));
  const [f, setF] = useState(() => {
    const saved = storage.get('lv_customer', {});
    return {
      mode: saved.mode === 'retirada' ? 'retirada' : 'entrega',
      pay: pays.includes(saved.pay) ? saved.pay : pays[0],
      name: saved.name || '', phone: maskPhone(saved.phone || ''), street: saved.street || '', number: saved.number || '',
      district: saved.district || '', complement: saved.complement || '', reference: saved.reference || '', change: '',
      website: '',
    };
  });
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const areas = Array.isArray(store.districts) ? store.districts : [];
  const fee = deliveryFeeFor(store, f.mode, f.district);
  const total = round2(subtotal + (fee || 0));

  const submit = async () => {
    setError('');
    if (!f.name.trim()) return setError('Informe seu nome.');
    if (phoneDigits(f.phone).length < 10) return setError('Informe seu WhatsApp com DDD.');
    if (f.mode === 'entrega' && (!f.street.trim() || !f.number.trim() || !f.district.trim()))
      return setError('Preencha rua, número e bairro para a entrega.');
    if (f.mode === 'entrega' && fee === null) return setError('Escolha um bairro atendido.');
    setSending(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: f.mode,
          customer: { name: f.name, phone: f.phone },
          address: f.mode === 'entrega'
            ? { street: f.street, number: f.number, district: f.district, complement: f.complement, reference: f.reference }
            : null,
          payment: { method: f.pay, changeFor: f.pay === 'dinheiro' ? parseMoney(f.change) || null : null },
          items: cart.map((i) => ({ productId: i.productId, qty: i.qty, optionIds: i.options.map((o) => o.id), note: i.note })),
          website: f.website,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Não foi possível enviar o pedido.');
      const { website, change, ...keep } = f;
      storage.set('lv_customer', keep);
      onDone(json.order);
    } catch (e) {
      setError(e.message);
      setSending(false);
    }
  };

  return (
    <Sheet
      title="Finalizar pedido"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onBack}>Voltar</button>
          <button className="btn primary" style={{ flex: 1 }} onClick={submit} disabled={sending || open === false}>
            {sending ? 'Enviando…' : <>Enviar pedido · <span className="num">{brl(total)}</span></>}
          </button>
        </>
      }
    >
      {open === false ? <div className="notice"><b>A loja está fechada agora.</b> {hoursText(store)}.</div> : null}
      <div className="field">
        <span className="lbl">Como você quer receber?</span>
        <div className="pillset" role="group">
          <button className="pill" aria-pressed={f.mode === 'entrega'} onClick={() => setF((s) => ({ ...s, mode: 'entrega' }))}>Entrega</button>
          <button className="pill" aria-pressed={f.mode === 'retirada'} onClick={() => setF((s) => ({ ...s, mode: 'retirada' }))}>Retirar no local</button>
        </div>
      </div>
      <div className="grid2">
        <div className="field"><label htmlFor="ck-name">Seu nome</label><input id="ck-name" autoComplete="name" value={f.name} onChange={set('name')} /></div>
        <div className="field"><label htmlFor="ck-phone">WhatsApp</label><input id="ck-phone" inputMode="tel" autoComplete="tel" placeholder="(86) 9 0000-0000" value={f.phone} onChange={(e) => {
          const v = e.target.value;
          setF((s) => {
            let d = v.replace(/\D/g, '');
            // apagou só um símbolo da máscara: apaga também o último número
            if (v.length < s.phone.length && d === s.phone.replace(/\D/g, '')) d = d.slice(0, -1);
            return { ...s, phone: maskPhone(d) };
          });
        }} /></div>
      </div>
      {f.mode === 'entrega' ? (
        <>
          {store.delivery_area ? <div className="notice">Entregamos somente na <b>{store.delivery_area}</b>.</div> : null}
          <div className="grid2">
            <div className="field span2"><label htmlFor="ck-street">Rua</label><input id="ck-street" autoComplete="address-line1" value={f.street} onChange={set('street')} /></div>
            <div className="field"><label htmlFor="ck-number">Número</label><input id="ck-number" value={f.number} onChange={set('number')} /></div>
            <div className="field">
              <label htmlFor="ck-district">Bairro</label>
              {areas.length ? (
                <select id="ck-district" value={f.district} onChange={set('district')}>
                  <option value="">Selecione</option>
                  {areas.map((d) => <option key={d.name} value={d.name}>{d.name} · {brl(d.fee)}</option>)}
                </select>
              ) : (
                <input id="ck-district" value={f.district} onChange={set('district')} />
              )}
            </div>
            <div className="field"><label htmlFor="ck-comp">Complemento</label><input id="ck-comp" value={f.complement} onChange={set('complement')} /></div>
            <div className="field"><label htmlFor="ck-ref">Ponto de referência</label><input id="ck-ref" value={f.reference} onChange={set('reference')} /></div>
          </div>
        </>
      ) : (
        <div className="box">
          <b>Retirada em</b><span>{store.address}</span>
          {store.maps_url ? <a className="btn sm" style={{ justifySelf: 'start' }} href={store.maps_url} target="_blank" rel="noopener noreferrer">Abrir no mapa</a> : null}
        </div>
      )}
      <div className="field">
        <span className="lbl">Pagamento (na entrega ou retirada)</span>
        <div className="pillset" role="group">
          {pays.map((k) => (
            <button key={k} className="pill" aria-pressed={f.pay === k} onClick={() => setF((s) => ({ ...s, pay: k }))}>{PAYMENTS[k]}</button>
          ))}
        </div>
      </div>
      {f.pay === 'dinheiro' ? (
        <div className="field"><label htmlFor="ck-change">Troco para quanto? (opcional)</label><input id="ck-change" inputMode="decimal" placeholder="Ex.: 100" value={f.change} onChange={set('change')} /></div>
      ) : null}
      {f.pay === 'pix' && store.pix_key ? (
        <div className="box">
          <span className="lbl">Chave Pix</span><b style={{ wordBreak: 'break-all' }}>{store.pix_key}</b>
          <small className="muted">Pague e envie o comprovante pelo WhatsApp. A loja confirma o pagamento.</small>
        </div>
      ) : null}
      <input type="text" name="website" value={f.website} onChange={set('website')} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />
      <div className="box">
        <div className="line"><span>Subtotal</span><span className="num">{brl(subtotal)}</span></div>
        <div className="line"><span>Taxa de entrega</span><span className="num">{f.mode === 'retirada' ? 'Grátis' : fee === null ? 'Escolha o bairro' : brl(fee)}</span></div>
        <div className="line total"><span>Total</span><span className="num">{brl(total)}</span></div>
      </div>
      {error ? <div className="err" role="alert">{error}</div> : null}
    </Sheet>
  );
}

function SuccessSheet({ order, store, onClose, toast }) {
  const msg = buildWhatsMessage(order, store);
  const link = waLink(store.whatsapp, msg);
  const copy = async () => {
    try { await navigator.clipboard.writeText(msg); toast('Mensagem copiada'); } catch { toast('Não deu para copiar automaticamente.'); }
  };
  return (
    <Sheet title="Pedido recebido" onClose={onClose}>
      <div style={{ textAlign: 'center', display: 'grid', gap: 6, padding: '8px 0' }}>
        <span className="lbl">Pedido</span>
        <b style={{ fontFamily: 'var(--display)', fontSize: 34, fontStretch: '125%' }}>#{order.number}</b>
        <span className="muted">A loja já recebeu seu pedido. Envie também pelo WhatsApp para agilizar.</span>
      </div>
      {link ? <a className="btn primary block" href={link} target="_blank" rel="noopener noreferrer">Enviar pedido no WhatsApp</a> : null}
      <button className="btn block" onClick={copy}>Copiar mensagem do pedido</button>
      <a className="btn ghost block" href={`/pedido/${order.token}`}>Acompanhar status</a>
    </Sheet>
  );
}
