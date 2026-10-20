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

// Custo do produto sempre calculado com o preço ATUAL dos insumos:
// alterou o insumo, todos os produtos que o usam mudam juntos.
export function custoProduto(produtoId, composicao, insumosPorId) {
  return composicao
    .filter((c) => c.produto_id === produtoId)
    .reduce((soma, c) => soma + Number(c.quantidade) * custoUnitario(insumosPorId[c.insumo_id]), 0);
}

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
