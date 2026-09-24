// Envia uma imagem para o Storage do Supabase (bucket "imagens").
// Fotos grandes de celular são reduzidas antes do envio.

async function shrink(file, maxSide = 1200) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 600 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const keepAlpha = file.type === 'image/png';
    const blob = await new Promise((r) => canvas.toBlob(r, keepAlpha ? 'image/png' : 'image/jpeg', 0.85));
    return blob || file;
  } catch {
    return file;
  }
}

export async function uploadImage(sb, file, folder = 'produtos') {
  if (!file || !file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem.');
  if (file.size > 15 * 1024 * 1024) throw new Error('A imagem deve ter até 15 MB.');
  const data = await shrink(file);
  const ext = data.type === 'image/png' ? 'png' : data.type === 'image/webp' ? 'webp' : data.type === 'image/gif' ? 'gif' : 'jpg';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await sb.storage.from('lv-imagens').upload(path, data, {
    cacheControl: '31536000', upsert: false, contentType: data.type || file.type,
  });
  if (error) throw new Error('Não foi possível enviar a imagem.');
  return sb.storage.from('lv-imagens').getPublicUrl(path).data.publicUrl;
}
