'use client';
import { useState } from 'react';
import { brl, moneyInput, parseMoney } from '@/lib/store';
import { uploadImage } from '@/lib/upload';
import { ConfirmButton, Photo, Sheet } from '../ui';

export default function MenuEditor({ sb, menu, reloadMenu, toast }) {
  const [catEdit, setCatEdit] = useState(null);
  const [prodEdit, setProdEdit] = useState(null);
  const { categories, products, groups } = menu;

  const move = async (i, d) => {
    const j = i + d;
    if (j < 0 || j >= categories.length) return;
    const order = [...categories];
    [order[i], order[j]] = [order[j], order[i]];
    const r = await Promise.all(order.map((c, n) => sb.from('lv_categories').update({ position: n + 1 }).eq('id', c.id)));
    if (r.some((x) => x.error)) toast('Não foi possível reordenar.');
    reloadMenu();
  };
  const toggle = async (p) => {
    const { error } = await sb.from('lv_products').update({ active: !p.active }).eq('id', p.id);
    if (error) return toast('Não foi possível alterar.');
    toast(!p.active ? `${p.name} disponível` : `${p.name} pausado`);
    reloadMenu();
  };

  return (
    <div className="stack">
      <div className="pillset">
        <button className="btn primary" onClick={() => (categories.length ? setProdEdit({}) : toast('Crie uma categoria primeiro.'))}>+ Novo produto</button>
        <button className="btn" onClick={() => setCatEdit({})}>+ Nova categoria</button>
      </div>
      {categories.map((c, ci) => {
        const ps = products.filter((p) => p.category_id === c.id);
        return (
          <div className="card" key={c.id}>
            <div className="cathead">
              <h3>{c.name}</h3>
              <button className="btn ghost sm" onClick={() => move(ci, -1)} disabled={ci === 0} aria-label="Subir categoria">↑</button>
              <button className="btn ghost sm" onClick={() => move(ci, 1)} disabled={ci === categories.length - 1} aria-label="Descer categoria">↓</button>
              <button className="btn sm" onClick={() => setCatEdit(c)}>Editar</button>
            </div>
            {ps.length ? ps.map((p) => (
              <div key={p.id} className={`prow ${p.active ? '' : 'off'}`}>
                <Photo src={p.image_url} />
                <div>
                  <b>{p.name}</b> {p.featured ? <span className="tag">Destaque</span> : null}<br />
                  <small className="muted num">{brl(p.price)}{p.group_ids.length ? ` · ${p.group_ids.length} grupo(s) de adicionais` : ''}</small>
                </div>
                <label className="switch" title="Disponível no cardápio">
                  <input type="checkbox" checked={p.active} onChange={() => toggle(p)} aria-label={`Disponível: ${p.name}`} /><span />
                </label>
                <button className="btn sm" onClick={() => setProdEdit(p)}>Editar</button>
              </div>
            )) : <p className="muted">Nenhum produto nesta categoria.</p>}
          </div>
        );
      })}
      {catEdit ? <CategorySheet c={catEdit} sb={sb} count={catEdit.id ? products.filter((p) => p.category_id === catEdit.id).length : 0} nextPos={categories.length + 1} onClose={() => setCatEdit(null)} onSaved={() => { setCatEdit(null); reloadMenu(); }} toast={toast} /> : null}
      {prodEdit ? <ProductSheet p={prodEdit} sb={sb} categories={categories} groups={groups} nextPos={products.length + 1} onClose={() => setProdEdit(null)} onSaved={() => { setProdEdit(null); reloadMenu(); }} toast={toast} /> : null}
    </div>
  );
}

function CategorySheet({ c, sb, count, nextPos, onClose, onSaved, toast }) {
  const [name, setName] = useState(c.name || '');
  const [error, setError] = useState('');
  const save = async () => {
    if (!name.trim()) return setError('Dê um nome à categoria.');
    const { error } = c.id
      ? await sb.from('lv_categories').update({ name: name.trim() }).eq('id', c.id)
      : await sb.from('lv_categories').insert({ name: name.trim(), position: nextPos });
    if (error) return setError('Não foi possível salvar.');
    toast('Categoria salva');
    onSaved();
  };
  const remove = async () => {
    const { error } = await sb.from('lv_categories').delete().eq('id', c.id);
    if (error) return setError('Não foi possível excluir.');
    toast('Categoria excluída');
    onSaved();
  };
  return (
    <Sheet
      title={c.id ? 'Editar categoria' : 'Nova categoria'}
      onClose={onClose}
      footer={<>{c.id && !count ? <ConfirmButton onConfirm={remove}>Excluir</ConfirmButton> : null}<span style={{ flex: 1 }} /><button className="btn primary" onClick={save}>Salvar</button></>}
    >
      <div className="field"><label htmlFor="cat-name">Nome da categoria</label><input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></div>
      {c.id ? <small className="muted">{count} produto(s) nesta categoria.{count ? ' Para excluir, mova ou exclua os produtos antes.' : ''}</small> : null}
      {error ? <div className="err">{error}</div> : null}
    </Sheet>
  );
}

function ProductSheet({ p, sb, categories, groups, nextPos, onClose, onSaved, toast }) {
  const isNew = !p.id;
  const [f, setF] = useState({
    name: p.name || '', description: p.description || '', price: moneyInput(p.price),
    category_id: p.category_id || categories[0]?.id, active: p.active ?? true, featured: p.featured ?? false,
    image_url: p.image_url || null, group_ids: p.group_ids || [],
  });
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { const url = await uploadImage(sb, file, 'produtos'); setF((s) => ({ ...s, image_url: url })); }
    catch (err) { toast(err.message); }
    setUploading(false);
  };

  const save = async () => {
    const price = parseMoney(f.price);
    if (!f.name.trim()) return setError('Informe o nome do produto.');
    if (!(price > 0)) return setError('Informe um preço maior que zero.');
    setSaving(true);
    const row = {
      name: f.name.trim(), description: f.description.trim(), price, category_id: f.category_id,
      active: f.active, featured: f.featured, image_url: f.image_url,
    };
    let id = p.id;
    if (isNew) {
      const { data, error } = await sb.from('lv_products').insert({ ...row, position: nextPos }).select('id').single();
      if (error) { setSaving(false); return setError('Não foi possível salvar.'); }
      id = data.id;
    } else {
      const { error } = await sb.from('lv_products').update(row).eq('id', id);
      if (error) { setSaving(false); return setError('Não foi possível salvar.'); }
    }
    // adicionais do produto
    const del = await sb.from('lv_product_addon_groups').delete().eq('product_id', id);
    const ins = f.group_ids.length
      ? await sb.from('lv_product_addon_groups').insert(f.group_ids.map((g, i) => ({ product_id: id, group_id: g, position: i + 1 })))
      : { error: null };
    setSaving(false);
    if (del.error || ins.error) return setError('Produto salvo, mas os adicionais não. Tente salvar de novo.');
    toast('Produto salvo');
    onSaved();
  };
  const remove = async () => {
    const { error } = await sb.from('lv_products').delete().eq('id', p.id);
    if (error) return setError('Não foi possível excluir.');
    toast('Produto excluído');
    onSaved();
  };
  const toggleGroup = (gid) => setF((s) => ({ ...s, group_ids: s.group_ids.includes(gid) ? s.group_ids.filter((x) => x !== gid) : [...s.group_ids, gid] }));

  return (
    <Sheet
      wide
      title={isNew ? 'Novo produto' : 'Editar produto'}
      onClose={onClose}
      footer={<>{!isNew ? <ConfirmButton onConfirm={remove}>Excluir</ConfirmButton> : null}<span style={{ flex: 1 }} /><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={save} disabled={saving || uploading}>{saving ? 'Salvando…' : 'Salvar'}</button></>}
    >
      <div className="imgpick">
        <Photo src={f.image_url} />
        <div style={{ display: 'grid', gap: 6 }}>
          <label className="btn sm" htmlFor="p-file">{uploading ? 'Enviando…' : f.image_url ? 'Trocar foto' : 'Enviar foto'}</label>
          <input id="p-file" type="file" accept="image/*" hidden onChange={onFile} />
          {f.image_url ? <button className="btn ghost sm danger" onClick={() => setF((s) => ({ ...s, image_url: null }))}>Remover foto</button> : null}
        </div>
      </div>
      <div className="field"><label htmlFor="p-name">Nome</label><input id="p-name" value={f.name} onChange={set('name')} maxLength={60} /></div>
      <div className="field"><label htmlFor="p-desc">Descrição</label><textarea id="p-desc" value={f.description} onChange={set('description')} maxLength={240} /></div>
      <div className="grid2">
        <div className="field"><label htmlFor="p-price">Preço (R$)</label><input id="p-price" inputMode="decimal" value={f.price} onChange={set('price')} placeholder="0,00" /></div>
        <div className="field">
          <label htmlFor="p-cat">Categoria</label>
          <select id="p-cat" value={f.category_id} onChange={set('category_id')}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="checks">
        <label><input type="checkbox" checked={f.active} onChange={set('active')} /> Disponível</label>
        <label><input type="checkbox" checked={f.featured} onChange={set('featured')} /> Destaque no topo</label>
      </div>
      <div className="field">
        <span className="lbl">Adicionais deste produto</span>
        {groups.length ? (
          <div className="checks">
            {groups.map((g) => <label key={g.id}><input type="checkbox" checked={f.group_ids.includes(g.id)} onChange={() => toggleGroup(g.id)} /> {g.name}</label>)}
          </div>
        ) : <small className="muted">Crie grupos na aba Adicionais.</small>}
      </div>
      {error ? <div className="err" role="alert">{error}</div> : null}
    </Sheet>
  );
}
