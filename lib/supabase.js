import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseEnv = () => !!(url && anon);

// Navegador (cardápio e painel). O login do painel fica salvo neste cliente.
let browserClient;
export function supabaseBrowser() {
  if (!browserClient) browserClient = createClient(url, anon);
  return browserClient;
}

// Servidor, leitura pública (cardápio).
export function supabasePublicServer() {
  return createClient(url, anon, { auth: { persistSession: false } });
}

// Servidor, acesso total. NUNCA importe isto em componente 'use client'.
export function supabaseService() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Faltam variáveis NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  return createClient(url, key, { auth: { persistSession: false } });
}
