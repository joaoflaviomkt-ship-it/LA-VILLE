'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hasSupabaseEnv, supabaseBrowser } from '@/lib/supabase';
import { loadMenu } from '@/lib/menu';
import { openInfo } from '@/lib/store';
import { useToast } from '../ui';
import Orders from './Orders';
import Comandas from './Comandas';
import Customers from './Customers';
import Revenue from './Revenue';
import MenuEditor from './MenuEditor';
import Addons from './Addons';
import StoreSettings from './StoreSettings';

const TABS = [
  ['pedidos', 'Pedidos'], ['comandas', 'Comandas'], ['clientes', 'Clientes'], ['faturamento', 'Faturamento'],
  ['cardapio', 'Cardápio'], ['adicionais', 'Adicionais'], ['loja', 'Loja'],
];

export default function Admin() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const sb = hasSupabaseEnv() ? supabaseBrowser() : null;
  const [phase, setPhase] = useState('loading'); // loading | denied | ready
  const [tab, setTab] = useState('pedidos');
  const [menu, setMenu] = useState(null);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [tabsError, setTabsError] = useState(false);
  const [sound, setSound] = useState(false);
  const [toast, toastNode] = useToast();
  const audio = useRef(null);
  const soundRef = useRef(false);
  soundRef.current = sound;

  const reloadMenu = useCallback(async () => setMenu(await loadMenu(sb)), [sb]);
  const reloadOrders = useCallback(async () => {
    const { data, error } = await sb.from('lv_orders').select('*').order('created_at', { ascending: false }).limit(2000);
    if (!error) setOrders(data.map((o) => ({ ...o, subtotal: +o.subtotal, delivery_fee: +o.delivery_fee, total: +o.total, change_for: o.change_for == null ? null : +o.change_for })));
  }, [sb]);
  // Comandas: as abertas + as dos últimos 45 dias
  const reloadTabs = useCallback(async () => {
    const since = new Date(Date.now() - 45 * 864e5).toISOString();
    const { data, error } = await sb.from('lv_tabs').select('*')
      .or(`status.eq.aberta,created_at.gte.${since}`)
      .order('created_at', { ascending: false }).limit(1000);
    if (error) { setTabsError(true); return; }
    setTabsError(false);
    setTabs(data.map(normTab));
  }, [sb]);
  // Atualiza uma comanda na hora (resposta das ações), sem esperar recarregar a lista
  const patchTab = useCallback((row) => {
    const t = normTab(row);
    setTabs((prev) => (prev.some((x) => x.id === t.id) ? prev.map((x) => (x.id === t.id ? t : x)) : [t, ...prev]));
  }, []);
  const reloadCustomers = useCallback(async () => {
    const { data, error } = await sb.from('lv_customers').select('*').order('created_at', { ascending: false }).limit(5000);
    if (!error) setCustomers(data);
  }, [sb]);

  useEffect(() => {
    if (!sb) return;
    let channel;
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { routerRef.current.replace('/painel/login'); return; }
      const { data: adm } = await sb.from('lv_admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
      if (!adm) { setPhase('denied'); return; }
      await Promise.all([reloadMenu(), reloadOrders(), reloadCustomers(), reloadTabs()]);
      setPhase('ready');
      channel = sb.channel('pedidos-painel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lv_orders' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            toast(`Novo pedido #${payload.new.number}${payload.new.mode === 'mesa' ? ` · Mesa ${payload.new.table_number}` : ''} · ${payload.new.customer_name}`);
            if (soundRef.current) beep(audio);
            reloadCustomers();
          }
          reloadOrders();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lv_tabs' }, () => { reloadTabs(); })
        .subscribe();
    })();
    const { data: sub } = sb.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') routerRef.current.replace('/painel/login'); });
    return () => { if (channel) sb.removeChannel(channel); sub.subscription.unsubscribe(); };
  }, [sb, reloadMenu, reloadOrders, reloadCustomers, reloadTabs, toast]);

  // Garante pedidos atualizados mesmo se o tempo real cair.
  useEffect(() => {
    if (phase !== 'ready') return;
    const t = setInterval(() => { reloadOrders(); reloadTabs(); }, 60000);
    return () => clearInterval(t);
  }, [phase, reloadOrders, reloadTabs]);

  const newCount = orders.filter((o) => o.status === 'novo').length;
  const openTabs = tabs.filter((t) => t.status === 'aberta').length;
  useEffect(() => { document.title = `${newCount ? `(${newCount}) ` : ''}Painel · La Ville Burger`; }, [newCount]);

  if (!sb) return <div className="wrap empty" style={{ paddingTop: 100 }}>Configure as variáveis do Supabase (veja o README).</div>;
  if (phase === 'loading') return <div className="wrap empty" style={{ paddingTop: 100 }}>Carregando painel…</div>;
  if (phase === 'denied') {
    return (
      <div className="login"><div className="card stack" style={{ maxWidth: 420 }}>
        <h2>Sem acesso ao painel</h2>
        <p className="muted">Este login ainda não foi liberado como administrador. Siga o passo “Liberar administrador” do README.</p>
        <button className="btn" onClick={() => sb.auth.signOut()}>Sair</button>
      </div></div>
    );
  }

  const oi = openInfo(menu.store);
  const ctx = { sb, menu, orders, customers, tabs, tabsError, reloadMenu, reloadOrders, reloadCustomers, reloadTabs, patchTab, toast };

  return (
    <>
      <div className="topbar">
        <div className="wrap-wide">
          <span className="brand">{menu.store?.name} · Painel</span>
          <button
            className="btn sm"
            onClick={() => { const on = !sound; setSound(on); if (on) beep(audio); toast(on ? 'Alerta sonoro ligado' : 'Alerta sonoro desligado'); }}
            aria-pressed={sound}
          >
            {sound ? '🔔 Som ligado' : '🔕 Ligar som de pedido'}
          </button>
          <a className="btn sm" href="/" target="_blank" rel="noopener noreferrer">Ver cardápio</a>
          <button className="btn sm" onClick={() => sb.auth.signOut()}>Sair</button>
        </div>
      </div>
      <div className="wrap-wide admin">
        <div className="ahead">
          <h1>Painel</h1>
          <span className={`chip ${oi.open ? 'open' : 'closed'}`}><span className="dot" />{oi.label}</span>
        </div>
        <div className="tabs" role="tablist">
          {TABS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              {l}{k === 'pedidos' && newCount ? <span className="badge">{newCount}</span> : null}
              {k === 'comandas' && openTabs ? <span className="badge soft">{openTabs}</span> : null}
            </button>
          ))}
        </div>
        {tab === 'pedidos' ? <Orders {...ctx} /> : null}
        {tab === 'comandas' ? <Comandas {...ctx} /> : null}
        {tab === 'clientes' ? <Customers {...ctx} /> : null}
        {tab === 'faturamento' ? <Revenue {...ctx} /> : null}
        {tab === 'cardapio' ? <MenuEditor {...ctx} /> : null}
        {tab === 'adicionais' ? <Addons {...ctx} /> : null}
        {tab === 'loja' ? <StoreSettings {...ctx} /> : null}
      </div>
      {toastNode}
    </>
  );
}

function normTab(t) {
  return {
    ...t,
    subtotal: +t.subtotal, discount: +t.discount, total: +t.total, paid: +t.paid,
    items: (t.items || []).map((i) => ({ ...i, qty: +i.qty, unit_price: +i.unit_price })),
    payments: (t.payments || []).map((p) => ({ ...p, amount: +p.amount, received: p.received == null ? null : +p.received, change: p.change == null ? null : +p.change })),
  };
}

function beep(ref) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!ref.current) ref.current = new Ctx();
    const ctx = ref.current;
    [0, 0.25].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.22);
    });
  } catch {}
}
