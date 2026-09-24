'use client';
import { useState } from 'react';
import { DAYS, moneyInput, parseMoney, PAYMENTS } from '@/lib/store';
import { uploadImage } from '@/lib/upload';
import { Photo } from '../ui';

const PAY_COL = { pix: 'pay_pix', cartao: 'pay_card', dinheiro: 'pay_cash' };

export default function StoreSettings({ sb, menu, reloadMenu, toast }) {
  const s = menu.store;
  const initial = () => ({
    name: s.name, description: s.description, whatsapp: s.whatsapp, prep_time: s.prep_time, address: s.address, maps_url: s.maps_url,
    status_override: s.status_override, open_days: s.open_days || [], open_time: s.open_time, close_time: s.close_time,
    delivery_fee: moneyInput(s.delivery_fee), min_order: moneyInput(s.min_order), delivery_area: s.delivery_area,
    districts: (s.districts || []).map((d, i) => ({ k: i, name: d.name, fee: moneyInput(d.fee) })),
    pay_pix: s.pay_pix, pay_card: s.pay_card, pay_cash: s.pay_cash, pix_key: s.pix_key,
    logo_url: s.logo_url, cover_url: s.cover_url, cover_logo_url: s.cover_logo_url,
  });
  const [f, setF] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');
  const upd = (patch) => { setF((x) => ({ ...x, ...patch })); setDirty(true); };
  const set = (k) => (e) => upd({ [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const onImage = (key) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(key);
    try { upd({ [key]: await uploadImage(sb, file, 'loja') }); } catch (err) { toast(err.message); }
    setUploading('');
  };

  const save = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) return toast('Informe o nome da loja.');
    if (!f.pay_pix && !f.pay_card && !f.pay_cash) return toast('Deixe ao menos uma forma de pagamento ativa.');
    const maps = f.maps_url.trim();
    setSaving(true);
    const { error } = await sb.from('lv_store').update({
      name: f.name.trim(), description: f.description.trim(), whatsapp: f.whatsapp.trim(), prep_time: f.prep_time.trim(),
      address: f.address.trim(), maps_url: /^https:\/\//.test(maps) ? maps : '',
      status_override: f.status_override, open_days: [...f.open_days].sort(), open_time: f.open_time || '17:00', close_time: f.close_time || '22:00',
      delivery_fee: parseMoney(f.delivery_fee), min_order: parseMoney(f.min_order), delivery_area: f.delivery_area.trim(),
      districts: f.districts.filter((d) => d.name.trim()).map((d) => ({ name: d.name.trim(), fee: parseMoney(d.fee) })),
      pay_pix: f.pay_pix, pay_card: f.pay_card, pay_cash: f.pay_cash, pix_key: f.pix_key.trim(),
      logo_url: f.logo_url, cover_url: f.cover_url, cover_logo_url: f.cover_logo_url,
    }).eq('id', 1);
    setSaving(false);
    if (error) return toast('Não foi possível salvar. Tente de novo.');
    setDirty(false);
    toast('Loja atualizada');
    reloadMenu();
  };

  const toggleDay = (i) => upd({ open_days: f.open_days.includes(i) ? f.open_days.filter((d) => d !== i) : [...f.open_days, i] });

  return (
    <form className="stack" onSubmit={save} autoComplete="off">
      <div className="cols">
        <div className="card stack">
          <b>Identidade</b>
          <div className="grid2">
            <div className="imgpick">
              <Photo src={f.logo_url} className="ph contain" style={{ background: "#fff", padding: 4 }} />
              <div style={{ display: 'grid', gap: 4 }}>
                <span className="lbl">Logo</span>
                <label className="btn sm" htmlFor="s-logo">{uploading === 'logo_url' ? 'Enviando…' : 'Trocar logo'}</label>
                <input id="s-logo" type="file" accept="image/*" hidden onChange={onImage('logo_url')} />
              </div>
            </div>
            <div className="imgpick">
              <Photo src={f.cover_url} />
              <div style={{ display: 'grid', gap: 4 }}>
                <span className="lbl">Capa</span>
                <label className="btn sm" htmlFor="s-cover">{uploading === 'cover_url' ? 'Enviando…' : 'Trocar capa'}</label>
                <input id="s-cover" type="file" accept="image/*" hidden onChange={onImage('cover_url')} />
                {f.cover_url ? <button type="button" className="btn ghost sm danger" onClick={() => upd({ cover_url: null })}>Remover</button> : null}
              </div>
            </div>
            <div className="imgpick span2">
              <Photo src={f.cover_logo_url} className="ph contain" style={{ background: '#333', padding: 4 }} />
              <div style={{ display: 'grid', gap: 4 }}>
                <span className="lbl">Logo sobre a capa (PNG sem fundo, versão clara)</span>
                <div className="pillset">
                  <label className="btn sm" htmlFor="s-coverlogo">{uploading === 'cover_logo_url' ? 'Enviando…' : 'Enviar'}</label>
                  <input id="s-coverlogo" type="file" accept="image/*" hidden onChange={onImage('cover_logo_url')} />
                  {f.cover_logo_url ? <button type="button" className="btn ghost sm danger" onClick={() => upd({ cover_logo_url: null })}>Remover</button> : null}
                </div>
              </div>
            </div>
          </div>
          <div className="field"><label htmlFor="s-name">Nome da loja</label><input id="s-name" value={f.name} onChange={set('name')} maxLength={60} /></div>
          <div className="field"><label htmlFor="s-desc">Descrição</label><textarea id="s-desc" value={f.description} onChange={set('description')} maxLength={200} /></div>
          <div className="grid2">
            <div className="field"><label htmlFor="s-wa">WhatsApp da loja (recebe pedidos)</label><input id="s-wa" inputMode="tel" value={f.whatsapp} onChange={set('whatsapp')} /></div>
            <div className="field"><label htmlFor="s-prep">Tempo estimado</label><input id="s-prep" placeholder="Ex.: 40 a 60 min" value={f.prep_time} onChange={set('prep_time')} /></div>
          </div>
          <div className="field"><label htmlFor="s-addr">Endereço</label><input id="s-addr" value={f.address} onChange={set('address')} /></div>
          <div className="field"><label htmlFor="s-maps">Link do Google Maps</label><input id="s-maps" placeholder="https://maps.app.goo.gl/…" value={f.maps_url} onChange={set('maps_url')} /></div>
        </div>

        <div className="stack">
          <div className="card stack">
            <b>Horário de funcionamento</b>
            <div className="field">
              <label htmlFor="s-status">Status da loja</label>
              <select id="s-status" value={f.status_override} onChange={set('status_override')}>
                <option value="auto">Automático pelo horário</option>
                <option value="open">Forçar aberta</option>
                <option value="closed">Forçar fechada</option>
              </select>
            </div>
            <div className="checks">
              {DAYS.map((d, i) => <label key={d}><input type="checkbox" checked={f.open_days.includes(i)} onChange={() => toggleDay(i)} /> {d}</label>)}
            </div>
            <div className="grid2">
              <div className="field"><label htmlFor="s-open">Abre</label><input id="s-open" type="time" value={f.open_time} onChange={set('open_time')} /></div>
              <div className="field"><label htmlFor="s-close">Fecha</label><input id="s-close" type="time" value={f.close_time} onChange={set('close_time')} /></div>
            </div>
          </div>

          <div className="card stack">
            <b>Entrega e pagamento</b>
            <div className="grid2">
              <div className="field"><label htmlFor="s-fee">Taxa de entrega (R$)</label><input id="s-fee" inputMode="decimal" value={f.delivery_fee} onChange={set('delivery_fee')} placeholder="0,00" /></div>
              <div className="field"><label htmlFor="s-min">Pedido mínimo (R$)</label><input id="s-min" inputMode="decimal" value={f.min_order} onChange={set('min_order')} placeholder="0,00" /></div>
            </div>
            <div className="field"><label htmlFor="s-area">Área de entrega (aparece para o cliente)</label><input id="s-area" placeholder="Ex.: Zona Leste" value={f.delivery_area} onChange={set('delivery_area')} /></div>
            <div className="field">
              <span className="lbl">Taxa por bairro (opcional, substitui a taxa fixa)</span>
              <div className="stack" style={{ gap: 8 }}>
                {f.districts.map((d) => (
                  <div className="optrow" key={d.k}>
                    <input className="input" aria-label="Bairro" placeholder="Bairro" value={d.name} onChange={(e) => upd({ districts: f.districts.map((x) => (x.k === d.k ? { ...x, name: e.target.value } : x)) })} />
                    <input className="input" aria-label="Taxa" inputMode="decimal" placeholder="0,00" value={d.fee} onChange={(e) => upd({ districts: f.districts.map((x) => (x.k === d.k ? { ...x, fee: e.target.value } : x)) })} />
                    <button type="button" className="btn ghost sm danger" aria-label="Remover bairro" onClick={() => upd({ districts: f.districts.filter((x) => x.k !== d.k) })}>×</button>
                  </div>
                ))}
              </div>
              <button type="button" className="btn sm" style={{ justifySelf: 'start' }} onClick={() => upd({ districts: [...f.districts, { k: Date.now(), name: '', fee: '' }] })}>+ Bairro</button>
            </div>
            <div className="checks">
              {Object.entries(PAYMENTS).map(([k, l]) => <label key={k}><input type="checkbox" checked={f[PAY_COL[k]]} onChange={set(PAY_COL[k])} /> {l}</label>)}
            </div>
            <div className="field"><label htmlFor="s-pix">Chave Pix</label><input id="s-pix" value={f.pix_key} onChange={set('pix_key')} /></div>
          </div>
        </div>
      </div>
      <div className="line savebar">
        <small className="muted">{dirty ? 'Alterações não salvas' : 'Tudo salvo'}</small>
        <div className="pillset">
          <button type="button" className="btn" disabled={!dirty} onClick={() => { setF(initial()); setDirty(false); }}>Descartar</button>
          <button type="submit" className="btn primary" disabled={saving || !!uploading}>{saving ? 'Salvando…' : 'Salvar alterações'}</button>
        </div>
      </div>
    </form>
  );
}
