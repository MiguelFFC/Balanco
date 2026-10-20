const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const moeda = (v) => brl.format(Number(v) || 0);

export const numero = (v, casas = 2) =>
  (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: casas });

export const porcentagem = (v) =>
  Number.isFinite(v)
    ? `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
    : '—';

// "2026-10-20" -> "20/10/2026"
export function dataBR(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

// Date -> "2026-10-20" (no fuso do aparelho, não em UTC)
export function paraISO(data) {
  const a = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const d = String(data.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

export const hojeISO = () => paraISO(new Date());

// "2026-10-20" -> Date local
export function deISO(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

// Aceita "18,50", "18.50", "1.234,56" e "R$ 18,50"
export function lerNumero(texto) {
  if (texto === null || texto === undefined) return NaN;
  if (typeof texto === 'number') return texto;
  let s = String(texto).replace(/[R$\s]/g, '').trim();
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  return /^-?\d*\.?\d+$/.test(s) ? Number(s) : NaN;
}

// Número -> texto para preencher campos ("18,5")
export const paraCampo = (v) =>
  v === null || v === undefined || v === '' ? '' : String(Number(v)).replace('.', ',');

export const normalizar = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
