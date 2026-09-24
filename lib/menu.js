// Lê loja + cardápio completo do Supabase e organiza para as telas.
export async function loadMenu(sb) {
  const [st, cats, prods, groups, opts, links] = await Promise.all([
    sb.from('lv_store').select('*').eq('id', 1).maybeSingle(),
    sb.from('lv_categories').select('*').order('position').order('name'),
    sb.from('lv_products').select('*').order('position').order('name'),
    sb.from('lv_addon_groups').select('*').order('position').order('name'),
    sb.from('lv_addon_options').select('*').order('position').order('name'),
    sb.from('lv_product_addon_groups').select('*').order('position'),
  ]);
  const failed = [st, cats, prods, groups, opts, links].find((r) => r.error);
  if (failed) throw failed.error;

  const store = st.data
    ? { ...st.data, delivery_fee: Number(st.data.delivery_fee), min_order: Number(st.data.min_order) }
    : null;
  const groupsFull = groups.data.map((g) => ({
    ...g,
    options: opts.data.filter((o) => o.group_id === g.id).map((o) => ({ ...o, price: Number(o.price) })),
  }));
  const products = prods.data.map((p) => ({
    ...p,
    price: Number(p.price),
    group_ids: links.data.filter((l) => l.product_id === p.id).map((l) => l.group_id),
  }));
  return { store, categories: cats.data, products, groups: groupsFull };
}
