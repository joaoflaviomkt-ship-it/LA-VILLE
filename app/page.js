import { Anton } from 'next/font/google';
import { hasSupabaseEnv, supabasePublicServer } from '@/lib/supabase';

// Anton: traço condensado, peso de placar/sinalização de quadra —
// a La Ville fica dentro de um complexo esportivo.
const display = Anton({ subsets: ['latin'], weight: '400' });

export const dynamic = 'force-dynamic';

// Valores usados quando o campo ainda não existe (ou está vazio) em lv_store.
// Assim a página nunca fica quebrada, e passa a seguir o banco assim que
// os campos forem preenchidos.
const DEFAULTS = {
  name: 'La Ville Burger',
  slogan: 'Hambúrguer artesanal de verdade, dentro da quadra.',
  whatsapp: '5586995120634', // (86) 99512-0634
  address: 'Av. Visconde da Parnaíba, 2780 - Horto Florestal',
  maps: 'https://maps.app.goo.gl/YakUW2ubFG9m2Kav5?g_st=ipc',
  ifood:
    'https://www.ifood.com.br/delivery/teresina-pi/la-ville-burger-horto/2694799c-5f72-4ff8-8a27-9049af716129',
  logo: '/img/logo-la-ville.png',
};

const C = {
  bg: '#15120F',
  text: '#F4EEE2',
  soft: '#C9BFAE',
  muted: '#9C9183',
  faint: '#6B6358',
  line: 'rgba(255,255,255,0.1)',
  gold: '#D4A017',
  ifood: '#EA1D2C',
};

// Primeiro campo de texto não vazio entre os nomes possíveis.
function pick(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

// Deixa só os números e garante o 55 na frente (aceita "(86) 99512-0634").
function waNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return DEFAULTS.whatsapp;
  return digits.length <= 11 ? `55${digits}` : digits;
}

async function getStore() {
  if (!hasSupabaseEnv()) return null;
  try {
    const { data } = await supabasePublicServer()
      .from('lv_store')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    return data || null;
  } catch {
    return null;
  }
}

export async function generateMetadata() {
  const store = await getStore();
  const name = pick(store, ['name']) || DEFAULTS.name;
  const description = pick(store, ['description']) || DEFAULTS.slogan;
  return { title: `${name} · Peça online`, description };
}

export default async function LandingPage() {
  const store = await getStore();

  const name = pick(store, ['name']) || DEFAULTS.name;
  const slogan = pick(store, ['slogan', 'tagline', 'description']) || DEFAULTS.slogan;
  const logo = pick(store, ['logo_url', 'logo']) || DEFAULTS.logo;
  const whatsapp = waNumber(pick(store, ['whatsapp', 'whatsapp_number']));
  const address = pick(store, ['address']) || DEFAULTS.address;
  const maps = pick(store, ['maps_url', 'location_url', 'map_url']) || DEFAULTS.maps;
  const ifood = pick(store, ['ifood_url', 'ifood']) || DEFAULTS.ifood;
  const hours = pick(store, ['opening_hours']);
  const deliveryTime = pick(store, ['delivery_time']);
  const isOpen = typeof store?.is_open === 'boolean' ? store.is_open : null;

  // Só mostra o aviso de aberto/fechado quando o banco realmente informa.
  let status = '';
  if (isOpen === true) status = deliveryTime ? `Aberto agora · entrega em ${deliveryTime}` : 'Aberto agora';
  else if (isOpen === false) status = hours ? `Fechado no momento · ${hours}` : 'Fechado no momento';
  else if (hours) status = hours;

  const actions = [
    { key: 'cardapio', label: 'Ver cardápio e pedir', sub: 'Monte seu pedido', href: '/cardapio' },
    { key: 'whatsapp', label: 'Falar no WhatsApp', sub: 'Dúvidas e contato direto', href: `https://wa.me/${whatsapp}` },
    { key: 'mapa', label: 'Como chegar', sub: address, href: maps },
    { key: 'ifood', label: 'Pedir pelo iFood', sub: 'Abrir nossa loja no app', href: ifood, accent: true },
  ];

  return (
    <main
      style={{
        minHeight: '100vh',
        background: C.bg,
        color: C.text,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <style>{`
        .lv-action { transition: background .15s; }
        .lv-action:hover, .lv-action:active { background: rgba(255,255,255,0.05); }
      `}</style>

      <section
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          textAlign: 'center',
          overflow: 'hidden',
          minHeight: '56vh',
          padding: '80px 24px 56px',
          boxSizing: 'border-box',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '-96px',
            right: '-15%',
            width: 'min(70vw, 480px)',
            height: 'min(70vw, 480px)',
            borderRadius: '50%',
            pointerEvents: 'none',
            background: 'radial-gradient(circle, #5C1414 0%, rgba(92,20,20,0) 70%)',
          }}
        />
        {/* Moldura clara: a logo aparece inteira (sem corte), seja quadrada ou larga,
            e fica legível mesmo se o arquivo tiver fundo transparente. */}
        <div
          style={{
            position: 'relative',
            marginBottom: 24,
            padding: '12px 20px',
            borderRadius: 20,
            background: '#FFFFFF',
            border: `2px solid ${C.gold}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            maxWidth: 'min(80vw, 320px)',
            boxSizing: 'border-box',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo}
            alt={name}
            style={{
              display: 'block',
              height: 76,
              width: 'auto',
              maxWidth: '100%',
              objectFit: 'contain',
            }}
          />
        </div>
        <h1
          className={display.className}
          style={{
            position: 'relative',
            margin: 0,
            fontWeight: 400,
            fontSize: 'clamp(40px, 13vw, 64px)',
            lineHeight: 0.95,
            letterSpacing: '0.5px',
            color: C.text,
          }}
        >
          {name.toUpperCase()}
        </h1>
        <p
          style={{
            position: 'relative',
            margin: '12px 0 0',
            maxWidth: 320,
            fontSize: 14,
            lineHeight: 1.4,
            color: C.soft,
          }}
        >
          {slogan}
        </p>
        {status ? (
          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 20,
              padding: '6px 16px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.15)',
              fontSize: 12,
              color: C.soft,
            }}
          >
            {isOpen !== null ? (
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: isOpen ? '#34d399' : '#f87171',
                  display: 'inline-block',
                }}
              />
            ) : null}
            {status}
          </div>
        ) : null}
      </section>

      <section style={{ maxWidth: 448, margin: '0 auto', borderTop: `1px solid ${C.line}` }}>
        {actions.map((action) => (
          <a
            key={action.key}
            href={action.href}
            className="lv-action"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: '20px 24px',
              borderBottom: `1px solid ${C.line}`,
              color: C.text,
              textDecoration: 'none',
              boxShadow: action.accent ? `inset 4px 0 0 0 ${C.ifood}` : 'none',
            }}
          >
            <span style={{ display: 'block', minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 16, fontWeight: 600, color: C.text }}>
                {action.label}
              </span>
              <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: C.muted }}>
                {action.sub}
              </span>
            </span>
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              style={{ flexShrink: 0, color: C.faint }}
            >
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        ))}
      </section>

      <footer style={{ padding: '40px 24px', textAlign: 'center', fontSize: 12, color: C.faint }}>
        {address}
      </footer>
    </main>
  );
}
