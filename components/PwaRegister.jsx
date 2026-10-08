'use client';
import { useEffect } from 'react';

// Registra o service worker do painel (necessário para o botão "Instalar app").
// Se o navegador não suportar ou algo falhar, o painel funciona normalmente.
export default function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/painel-sw.js', { scope: '/painel' }).catch(() => {});
  }, []);
  return null;
}
