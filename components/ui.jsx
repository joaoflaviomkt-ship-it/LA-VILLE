'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export function BurgerIcon() {
  return (
    <svg width="40%" height="40%" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M8 20c0-8 7-13 16-13s16 5 16 13H8z" fill="currentColor" />
      <rect x="6" y="23" width="36" height="4" rx="2" fill="currentColor" opacity=".55" />
      <rect x="7" y="29" width="34" height="5" rx="2.5" fill="currentColor" opacity=".8" />
      <path d="M8 37h32c0 3-2 5-5 5H13c-3 0-5-2-5-5z" fill="currentColor" />
    </svg>
  );
}

export function Photo({ src, className = 'ph', style }) {
  return (
    <div className={className} style={style}>
      {src ? <img src={src} alt="" loading="lazy" /> : <BurgerIcon />}
    </div>
  );
}

export function Sheet({ title, onClose, children, footer, wide }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector('button.x')?.focus({ preventScroll: true });
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, []);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`sheet ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="x" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer ? <div className="sheet-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState(null);
  const timer = useRef(null);
  const toast = useCallback((m) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2800);
  }, []);
  const node = msg ? <div className="toast" role="status">{msg}</div> : null;
  return [toast, node];
}

// Botão que pede um segundo toque para confirmar ações destrutivas.
export function ConfirmButton({ onConfirm, children, className = 'btn ghost danger', confirmText = 'Confirmar?' }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button type="button" className={className} onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}>
      {armed ? confirmText : children}
    </button>
  );
}

export const storage = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
};
