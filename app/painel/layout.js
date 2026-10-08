import PwaRegister from '@/components/PwaRegister';

// Faz do painel um app instalável (PWA): ícone na tela inicial e abertura em tela cheia.
export const metadata = {
  manifest: '/app-painel/manifest.webmanifest',
  icons: {
    icon: [{ url: '/app-painel/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/app-painel/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'Painel La Ville', statusBarStyle: 'black' },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#141110',
};

export default function PainelLayout({ children }) {
  return (
    <>
      {children}
      <PwaRegister />
    </>
  );
}
