'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hasSupabaseEnv, supabaseBrowser } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'Entrar · Painel La Ville';
    if (!hasSupabaseEnv()) return;
    supabaseBrowser().auth.getSession().then(({ data }) => { if (data.session) routerRef.current.replace('/painel'); });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError('E-mail ou senha incorretos.');
    else router.replace('/painel');
  };

  return (
    <div className="login">
      <form className="card stack" onSubmit={submit}>
        <div>
          <span className="lbl">La Ville Burger</span>
          <h1 style={{ fontSize: 26, marginTop: 4 }}>Painel do dono</h1>
        </div>
        <div className="field"><label htmlFor="email">E-mail</label><input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="field"><label htmlFor="password">Senha</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        {error ? <div className="err" role="alert">{error}</div> : null}
        <button className="btn primary block" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        <a href="/" className="btn ghost sm" style={{ justifySelf: 'center' }}>Ver cardápio</a>
      </form>
    </div>
  );
}
