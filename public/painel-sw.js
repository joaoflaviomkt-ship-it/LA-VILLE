// Service worker mínimo do painel. Existe só para o navegador oferecer "Instalar app".
// NÃO guarda nada em cache e NÃO intercepta nada: pedidos, preços e login sempre vêm
// ao vivo do servidor, exatamente como no navegador comum.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // sem event.respondWith(): o navegador trata a requisição normalmente
});
