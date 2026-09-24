'use client';
import { useState } from 'react';
import { brl, moneyInput, parseMoney } from '@/lib/store';
import { ConfirmButton, Sheet } from '../ui';

const tmpId = () => 'tmp-' + Math.random().toString(36).slice(2, 9);

export default function Addons({ sb, menu, reloadMenu, toast }) {
  const [editing, setEditing] = useState(null);
  const { groups, products } = menu;
  return (
    <div className="stack">
      <div><button className="btn primary" onClick={() => setEditing({})}>+ Novo grupo de adicionais</button></div>
      <p className="muted" style={{ margin: 0 }}>
        Um grupo reúne opções como “Adicionais” ou “Tipo de pão”. Marque a escolha como obrigatória quando o cliente precisar escolher, e vincule o grupo aos produtos.
      </p>
      <div className="orders">
        {groups.map((g) => {
          const used = products.filter((p) => p.group_ids.includes(g.id));
          return (
            <div className="card stack" style={{ gap: 8 }} key={g.id}>
              <div className="line"><b>{g.name}</b>{g.min_select > 0 ? <span className="req">Obrigatório</span> : null}</div>
              <small className="muted">{g.max_select === 1 ? 'Escolhe 1' : `Até ${g.max_select} opções`} · usado em {used.length} produto(s)</small>
              <div>
                {g.options.map((o) => (
                  <div key={o.id} className="line" style={{ fontSize: 14 }}><span>{o.name}</span><span className="num muted">{o.price ? `+ ${brl(o.price)}` : 'grátis'}</span></div>
                ))}
              </div>
              <button className="btn sm" style={{ justifySelf: 'start' }} onClick={() => setEditing(g)}>Editar</button>
            </div>
          );
        })}
      </div>
      {editing ? <GroupSheet g={editing} sb={sb} products={products} nextPos={groups.length + 1} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reloadMenu(); }} toast={toast} /> : null}
    </div>
  );
}

function GroupSheet({ g, sb, products, nextPos, onClose, onSaved, toast }) {
  const isNew = !g.id;
  const [name, setName] = useState(g.name || '');
  const [required, setRequired] = useState((g.min_select || 0) > 0);
  const [max, setMax] = useState(g.max_select || 3);
  const [opts, setOpts] = useState(
    g.options?.length ? g.options.map((o) => ({ id: o.id, name: o.name, price: moneyInput(o.price) })) : [{ id: tmpId(), name: '', price: '' }]
  );
  const [linked, setLinked] = useState(isNew ? [] : products.filter((p) => p.group_ids.includes(g.id)).map((p) => p.id));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const setOpt = (id, k, v) => setOpts((list) => list.map((o) => (o.id === id ? { ...o, [k]: v } : o)));

  const save = async () => {
    const clean = opts.map((o) => ({ ...o, name: o.name.trim(), price: parseMoney(o.price) })).filter((o) => o.name);
    if (!name.trim()) return setError('Dê um nome ao grupo.');
    if (!clean.length) return setError('Adicione pelo menos uma opção.');
    const maxSel = Math.max(1, Math.min(20, parseInt(max, 10) || 1));
    const minSel = required ? 1 : 0;
    setSaving(true);
    const fail = (m) => { setSaving(false); setError(m); };

    let gid = g.id;
    const row = { name: name.trim(), min_select: minSel, max_select: maxSel };
    if (isNew) {
      const { data, error } = await sb.from('lv_addon_groups').insert({ ...row, position: nextPos }).select('id').single();
      if (error) return fail('Não foi possível salvar o grupo.');
      gid = data.id;
    } else {
      const { error } = await sb.from('lv_addon_groups').update(row).eq('id', gid);
      if (error) return fail('Não foi possível salvar o grupo.');
    }

    // opções: atualiza as existentes, cria as novas, apaga as removidas
    const keep = clean.filter((o) => !o.id.startsWith('tmp-'));
    const removed = (g.options || []).filter((o) => !keep.some((k) => k.id === o.id)).map((o) => o.id);
    if (removed.length) {
      const { error } = await sb.from('lv_addon_options').delete().in('id', removed);
      if (error) return fail('Não foi possível remover opções.');
    }
    for (const [i, o] of clean.entries()) {
      const data = { group_id: gid, name: o.name, price: o.price, position: i + 1 };
      const { error } = o.id.startsWith('tmp-')
        ? await sb.from('lv_addon_options').insert(data)
        : await sb.from('lv_addon_options').update(data).eq('id', o.id);
      if (error) return fail('Não foi possível salvar as opções.');
    }

    // produtos vinculados
    const before = isNew ? [] : products.filter((p) => p.group_ids.includes(gid)).map((p) => p.id);
    const toAdd = linked.filter((id) => !before.includes(id));
    const toRemove = before.filter((id) => !linked.includes(id));
    if (toRemove.length) {
      const { error } = await sb.from('lv_product_addon_groups').delete().eq('group_id', gid).in('product_id', toRemove);
      if (error) return fail('Não foi possível atualizar os produtos.');
    }
    if (toAdd.length) {
      const { error } = await sb.from('lv_product_addon_groups').insert(toAdd.map((pid) => {
        const p = products.find((x) => x.id === pid);
        return { product_id: pid, group_id: gid, position: (p?.group_ids.length || 0) + 1 };
      }));
      if (error) return fail('Não foi possível atualizar os produtos.');
    }
    setSaving(false);
    toast('Adicionais salvos');
    onSaved();
  };

  const remove = async () => {
    const { error } = await sb.from('lv_addon_groups').delete().eq('id', g.id);
    if (error) return setError('Não foi possível excluir.');
    toast('Grupo excluído');
    onSaved();
  };

  return (
    <Sheet
      wide
      title={isNew ? 'Novo grupo de adicionais' : 'Editar adicionais'}
      onClose={onClose}
      footer={<>{!isNew ? <ConfirmButton onConfirm={remove}>Excluir grupo</ConfirmButton> : null}<span style={{ flex: 1 }} /><button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button></>}
    >
      <div className="field"><label htmlFor="g-name">Nome do grupo</label><input id="g-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Adicionais" maxLength={50} /></div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="g-req">Escolha</label>
          <select id="g-req" value={required ? '1' : '0'} onChange={(e) => setRequired(e.target.value === '1')}>
            <option value="0">Opcional</option><option value="1">Obrigatória</option>
          </select>
        </div>
        <div className="field"><label htmlFor="g-max">Máximo de opções</label><input id="g-max" type="number" min="1" max="20" value={max} onChange={(e) => setMax(e.target.value)} /></div>
      </div>
      <div className="field">
        <span className="lbl">Opções e preços</span>
        <div className="stack" style={{ gap: 8 }}>
          {opts.map((o) => (
            <div className="optrow" key={o.id}>
              <input className="input" aria-label="Nome da opção" placeholder="Ex.: Bacon" value={o.name} onChange={(e) => setOpt(o.id, 'name', e.target.value)} />
              <input className="input" aria-label="Preço" inputMode="decimal" placeholder="0,00" value={o.price} onChange={(e) => setOpt(o.id, 'price', e.target.value)} />
              <button className="btn ghost sm danger" onClick={() => setOpts((l) => l.filter((x) => x.id !== o.id))} aria-label="Remover opção">×</button>
            </div>
          ))}
        </div>
        <button className="btn sm" style={{ justifySelf: 'start' }} onClick={() => setOpts((l) => [...l, { id: tmpId(), name: '', price: '' }])}>+ Opção</button>
      </div>
      <div className="field">
        <span className="lbl">Aparece nos produtos</span>
        <div className="checks">
          {products.map((p) => (
            <label key={p.id}>
              <input type="checkbox" checked={linked.includes(p.id)} onChange={() => setLinked((l) => (l.includes(p.id) ? l.filter((x) => x !== p.id) : [...l, p.id]))} /> {p.name}
            </label>
          ))}
        </div>
      </div>
      {error ? <div className="err" role="alert">{error}</div> : null}
    </Sheet>
  );
}
