import './globals.css';

export const metadata = {
  title: 'La Ville Burger · Peça online',
  description: 'Hambúrguer artesanal em Teresina. Peça online para entrega ou retirada.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#D62B35',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@112,700;112,800;125,900&family=Figtree:wght@400;500;600;700&display=swap"
        />
        <link rel="icon" href="/img/logo.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
