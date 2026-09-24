import Menu from '@/components/Menu';
import { loadMenu } from '@/lib/menu';
import { hasSupabaseEnv, supabasePublicServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  try {
    if (!hasSupabaseEnv()) return {};
    const { data } = await supabasePublicServer().from('lv_store').select('name, description').eq('id', 1).maybeSingle();
    return data ? { title: `${data.name} · Peça online`, description: data.description } : {};
  } catch {
    return {};
  }
}

export default async function Page() {
  if (!hasSupabaseEnv()) {
    return (
      <div className="wrap empty" style={{ paddingTop: 100 }}>
        <h2>Configuração pendente</h2>
        <p>Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY (veja o README).</p>
      </div>
    );
  }
  let data;
  try {
    data = await loadMenu(supabasePublicServer());
  } catch (e) {
    console.error(e);
    return (
      <div className="wrap empty" style={{ paddingTop: 100 }}>
        <h2>Cardápio indisponível no momento</h2>
        <p>Tente de novo em alguns instantes.</p>
      </div>
    );
  }
  if (!data.store) {
    return (
      <div className="wrap empty" style={{ paddingTop: 100 }}>
        <h2>Loja ainda não configurada</h2>
        <p>Rode o arquivo supabase/seed.sql no Supabase.</p>
      </div>
    );
  }
  return <Menu data={data} />;
}
