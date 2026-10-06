// Encaminha laville.online/mesa para o projeto separado do sistema de mesas.
// Só funciona depois que a variável MESAS_URL for cadastrada na Vercel (projeto de pedidos),
// com o endereço do projeto das mesas, por exemplo: https://la-ville-mesas.vercel.app
// Sem a variável (ou com um valor inválido) nada muda no site.
const raw = (process.env.MESAS_URL || '').trim().replace(/\/+$/, '');
const MESAS_URL = /^https:\/\/[A-Za-z0-9.-]+$/.test(raw) ? raw : '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    if (!MESAS_URL) return [];
    return [
      { source: '/mesa', destination: `${MESAS_URL}/mesa` },
      { source: '/mesa/:path*', destination: `${MESAS_URL}/mesa/:path*` },
    ];
  },
};
export default nextConfig;
