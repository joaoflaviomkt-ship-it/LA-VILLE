// Pix "copia e cola" e QR Code com valor, no padrão BR Code do Banco Central.
// Tudo gerado aqui mesmo, sem API externa e sem custo.
// O QR é estático: o dinheiro cai direto na chave Pix da loja e a confirmação
// do recebimento é feita pelo dono no painel (conferindo no app do banco).

// Remove acentos e tudo que não for letra, número ou espaço (o padrão pede texto simples).
export function pixText(s, max) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, max)
    .trim();
}

function cpfValido(d) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const dig = (n) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dig(9) === Number(d[9]) && dig(10) === Number(d[10]);
}

function cnpjValido(d) {
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (n) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((a, p, i) => a + p * Number(d[i]), 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

/**
 * Descobre o tipo da chave e deixa no formato que o Pix exige.
 * Celular precisa ir como +55DDDNÚMERO; CPF/CNPJ só com números; e-mail em minúsculas.
 */
export function normalizePixKey(raw) {
  const k = String(raw || '').trim();
  if (!k) return { key: '', type: '' };
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) return { key: k.toLowerCase(), type: 'aleatoria' };
  if (k.includes('@')) return { key: k.toLowerCase(), type: 'email' };
  const d = k.replace(/\D/g, '');
  if (k.startsWith('+')) return { key: `+${d}`, type: 'celular' };
  if (d.length === 14 && cnpjValido(d)) return { key: d, type: 'cnpj' };
  if (d.length === 11 && cpfValido(d)) return { key: d, type: 'cpf' };
  // (86) 99999-9999, 86999999999 ou 5586999999999 → celular
  if ((d.length === 10 || d.length === 11) && !/^0/.test(d)) return { key: `+55${d}`, type: 'celular' };
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return { key: `+${d}`, type: 'celular' };
  return { key: k, type: 'desconhecida' };
}

export const PIX_KEY_LABEL = {
  cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', celular: 'Celular', aleatoria: 'Chave aleatória', desconhecida: 'Formato não reconhecido',
};

// CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido no final do código Pix.
export function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const campo = (id, valor) => {
  const v = String(valor);
  if (v.length > 99) throw new Error(`Campo Pix ${id} grande demais.`);
  return id + String(v.length).padStart(2, '0') + v;
};

/**
 * Monta o código Pix (o mesmo texto vira o QR Code e o "copia e cola").
 * @param {object} o
 * @param {string} o.key     chave Pix da loja
 * @param {string} o.name    nome de quem recebe (até 25 letras)
 * @param {string} o.city    cidade de quem recebe (até 15 letras)
 * @param {number} o.amount  valor em reais (ex.: 37.5). 0 ou vazio = a pessoa digita o valor.
 * @param {string} [o.txid]  identificador que aparece no extrato de alguns bancos (até 25 letras/números)
 */
export function pixPayload({ key, name, city, amount, txid }) {
  const chave = normalizePixKey(key).key;
  if (!chave) throw new Error('Cadastre a chave Pix da loja em Loja → Entrega e pagamento.');
  const nome = pixText(name, 25) || 'LOJA';
  const cidade = pixText(city, 15) || 'BRASIL';
  const id = String(txid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
  const valor = Number(amount) > 0 ? (Math.round(Number(amount) * 100) / 100).toFixed(2) : '';

  let p = campo('00', '01');
  p += campo('26', campo('00', 'br.gov.bcb.pix') + campo('01', chave));
  p += campo('52', '0000');
  p += campo('53', '986');
  if (valor) p += campo('54', valor);
  p += campo('58', 'BR');
  p += campo('59', nome);
  p += campo('60', cidade);
  p += campo('62', campo('05', id));
  p += '6304';
  return p + crc16(p);
}
