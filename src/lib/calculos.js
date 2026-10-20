export const UNIDADES_COMPRA = [
  { id: 'kg', nome: 'kg (quilo)', base: 'g', fator: 1000 },
  { id: 'g', nome: 'g (grama)', base: 'g', fator: 1 },
  { id: 'L', nome: 'L (litro)', base: 'ml', fator: 1000 },
  { id: 'ml', nome: 'ml (mililitro)', base: 'ml', fator: 1 },
  { id: 'un', nome: 'unidade', base: 'un', fator: 1 },
];

export const unidadeCompra = (id) => UNIDADES_COMPRA.find((u) => u.id === id) || UNIDADES_COMPRA[4];

export const custoUnitario = (insumo) =>
  insumo && Number(insumo.quantidade_embalagem) > 0
    ? Number(insumo.valor_pago) / Number(insumo.quantidade_embalagem)
    : 0;

// Preço para atingir a margem desejada (sobre o preço de venda),
// já considerando uma taxa percentual (iFood/cartão) se informada.
export function precoSugerido(custo, margemPct, taxaPct = 0) {
  const divisor = 1 - (Number(margemPct) + Number(taxaPct)) / 100;
  if (divisor <= 0 || custo <= 0) return null;
  return custo / divisor;
}

export function analisarPreco(preco, custo, taxaPct) {
  const lucro = preco - custo;
  const taxa = (preco * taxaPct) / 100;
  const lucroComTaxa = lucro - taxa;
  return {
    lucro,
    margem: preco > 0 ? (lucro / preco) * 100 : NaN,
    taxa,
    lucroComTaxa,
    margemComTaxa: preco > 0 ? (lucroComTaxa / preco) * 100 : NaN,
  };
}

export const CANAIS = ['iFood', 'WhatsApp', 'Balcão', 'Outros'];
export const FORMAS_PAGAMENTO = ['Pix', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Boleto', 'Transferência', 'iFood (pago no app)', 'Outros'];
export const UNIDADES_LIVRES = ['un', 'kg', 'g', 'L', 'ml', 'pct', 'cx', 'balde', 'fardo', 'mês', 'serviço'];

// Unidades em que um insumo pode ser comprado/contado, conforme a unidade base
export const unidadesDaBase = (base) => UNIDADES_COMPRA.filter((u) => u.base === base);

// Custos do produto separados em fixo (copo, tampa, açaí...) e acompanhamentos.
// "medio" considera a quantidade de acompanhamentos inclusos pela média de custo deles.
export function custosProduto(produto, composicao, insumosPorId) {
  const itens = composicao.filter((c) => c.produto_id === produto.id);
  const custoItem = (c) => Number(c.quantidade) * custoUnitario(insumosPorId[c.insumo_id]);
  const fixo = itens.filter((c) => c.tipo !== 'acompanhamento').reduce((s, c) => s + custoItem(c), 0);
  const acomps = itens.filter((c) => c.tipo === 'acompanhamento').map(custoItem).sort((a, b) => a - b);
  const n = Math.min(Number(produto.qtd_acompanhamentos ?? 0), acomps.length);
  const media = acomps.length ? acomps.reduce((s, v) => s + v, 0) / acomps.length : 0;
  const soma = (lista) => lista.reduce((s, v) => s + v, 0);
  return {
    fixo,
    qtdAcomp: n,
    totalAcomps: acomps.length,
    medio: fixo + n * media,
    minimo: fixo + soma(acomps.slice(0, n)),
    maximo: fixo + soma(acomps.slice(acomps.length - n)),
  };
}

// Mostra uma quantidade na unidade mais amigável (g -> kg, ml -> L)
export function formatarQtd(valor, base) {
  const v = Number(valor) || 0;
  const fmt = (x, casas) => x.toLocaleString('pt-BR', { maximumFractionDigits: casas });
  if (base === 'g' && Math.abs(v) >= 1000) return `${fmt(v / 1000, 2)} kg`;
  if (base === 'ml' && Math.abs(v) >= 1000) return `${fmt(v / 1000, 2)} L`;
  return `${fmt(v, base === 'un' ? 0 : 1)} ${base}`;
}

export function situacaoEstoque(estoque, minimo) {
  if (estoque <= 0) return { id: 'zerado', nome: 'Sem estoque' };
  if (minimo > 0 && estoque < minimo) return { id: 'baixo', nome: 'Estoque baixo' };
  return { id: 'ok', nome: 'OK' };
}
