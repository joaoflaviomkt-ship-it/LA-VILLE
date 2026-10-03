import { Anton, Inter } from "next/font/google";
import { createClient } from "@supabase/supabase-js";

// Anton: traço condensado, peso de placar/sinalização de quadra —
// combina com o fato de a La Ville ficar dentro de um complexo esportivo.
const display = Anton({ subsets: ["latin"], weight: "400", variable: "--font-display" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const revalidate = 60; // revalida a cada 60s — dados do painel refletem rápido, sem bater no banco a cada acesso

// Valores reais da loja, usados como padrão até o painel de configurações
// (lv_settings) ser preenchido — assim os botões já funcionam de imediato,
// e passam a ser controlados pelo painel assim que o dono configurar lá.
const DEFAULT_WHATSAPP = "5586995120634"; // (86) 99512-0634
const DEFAULT_MAPS_URL = "https://maps.app.goo.gl/YakUW2ubFG9m2Kav5?g_st=ipc";
const DEFAULT_ADDRESS = "Rua Visconde da Parnaíba, 2790";
const DEFAULT_LOGO = "/img/logo-la-ville.png"; // public/img/logo-la-ville.png, já no projeto
const DEFAULT_IFOOD_URL = "https://www.ifood.com.br/delivery/teresina-pi/la-ville-burger-horto/2694799c-5f72-4ff8-8a27-9049af716129";

async function getSettings() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const { data } = await supabase.from("lv_settings").select("*").eq("id", 1).single();
  return data;
}

function todayStatus(hours) {
  if (!hours) return "Confira nosso horário";
  const days = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
  const today = days[new Date().getDay()];
  const todayHours = hours[today];
  if (!todayHours) return "Fechado hoje";
  const [, close] = todayHours.split("-");
  return close ? `Aberto hoje até ${close}` : "Aberto hoje";
}

export default async function LandingPage() {
  const settings = await getSettings();

  const storeName = settings?.store_name ?? "La Ville Hamburgueria";
  const logoUrl = settings?.logo_url || DEFAULT_LOGO;
  const whatsapp = settings?.whatsapp_number || DEFAULT_WHATSAPP;
  const ifoodUrl = settings?.ifood_url || DEFAULT_IFOOD_URL;
  const mapsUrl = settings?.maps_url || DEFAULT_MAPS_URL;
  const address = settings?.address || DEFAULT_ADDRESS;

  const actions = [
    {
      key: "cardapio",
      label: "Ver cardápio e pedir",
      sub: "Monte seu pedido",
      href: "/cardapio",
      show: true,
    },
    {
      key: "whatsapp",
      label: "Falar no WhatsApp",
      sub: "Dúvidas e contato direto",
      href: `https://wa.me/${whatsapp}`,
      show: true,
    },
    {
      key: "mapa",
      label: "Como chegar",
      sub: address,
      href: mapsUrl,
      show: true,
    },
    {
      key: "ifood",
      label: "Pedir pelo iFood",
      sub: "Abrir nossa loja no app",
      href: ifoodUrl,
      show: true,
      accent: true,
    },
  ].filter((a) => a.show);

  return (
    <main className={`${display.variable} ${body.variable} min-h-screen bg-[#15120F] text-[#F4EEE2]`} style={{ fontFamily: "var(--font-body)" }}>
      {/* HERO */}
      <section className="relative flex flex-col items-center justify-end px-6 pb-14 pt-20 text-center overflow-hidden min-h-[56vh]">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-[-15%] h-[70vw] w-[70vw] max-h-[480px] max-w-[480px] rounded-full"
          style={{ background: "radial-gradient(circle, #5C1414 0%, rgba(92,20,20,0) 70%)" }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={storeName}
          className="relative z-10 mb-6 h-20 w-20 rounded-full border-2 border-[#D4A017] object-cover"
        />
        <h1
          className="relative z-10 text-5xl leading-[0.95] tracking-tight sm:text-6xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {storeName.toUpperCase()}
        </h1>
        <p className="relative z-10 mt-3 max-w-xs text-sm text-[#C9BFAE]">
          Hambúrguer artesanal de verdade, dentro da quadra.
        </p>
        <div className="relative z-10 mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-1.5 text-xs text-[#C9BFAE]">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          {todayStatus(settings?.opening_hours ?? null)}
        </div>
      </section>

      {/* AÇÕES — grade estilo linhas de quadra, não cartões soltos */}
      <section className="mx-auto max-w-md border-t border-white/10">
        {actions.map((action) => (
          <a
            key={action.key}
            href={action.href}
            className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-5 transition-colors active:bg-white/5"
            style={action.accent ? { boxShadow: "inset 4px 0 0 0 #EA1D2C" } : undefined}
          >
            <span>
              <span className="block text-base font-semibold text-[#F4EEE2]">{action.label}</span>
              <span className="block text-xs text-[#9C9183]">{action.sub}</span>
            </span>
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0 text-[#6B6358]">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        ))}
      </section>

      <footer className="px-6 py-10 text-center text-xs text-[#6B6358]">
        {address}
      </footer>
    </main>
  );
}
