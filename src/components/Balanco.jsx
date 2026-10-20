import { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { useDados } from '../lib/dados';
import { useLancamentos } from '../lib/hooks';
import { moeda, porcentagem, numero, dataBR } from '../lib/format';
import { diasEntre } from '../lib/periodo';
import { Aviso, Carregando, FiltroPeriodo, Vazio, usePeriodo } from './ui';

const COR_ENTRADA = '#6250d6';
const COR_SAIDA = '#eb6834';
const COR_BARRA = '#7b2d8e';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const moedaCurta = (v) =>
  Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `R$ ${Math.round(v)}`;

function agrupar(linhas, chave, valor) {
  const m = new Map();
  for (const l of linhas) {
    const k = chave(l);
    m.set(k, (m.get(k) || 0) + valor(l));
  }
  return [...m.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
}

export default function Balanco() {
  const { versao } = useDados();
  const p = usePeriodo('mes');
  const vendas = useLancamentos('vendas', p.inicio, p.fim, versao);
  const compras = useLancamentos('compras', p.inicio, p.fim, versao);
  const carregando = vendas.carregando || compras.carregando;

  const r = useMemo(() => {
    const V = vendas.linhas;
    const C = compras.linhas;
    const faturamento = V.reduce((a, v) => a + Number(v.valor_recebido), 0);
    const taxas = V.reduce((a, v) => a + Number(v.taxa_reais), 0);
    const gastos = C.reduce((a, c) => a + Number(c.valor_total), 0);
    const lucro = faturamento - gastos - taxas;
    const margem = faturamento > 0 ? (lucro / faturamento) * 100 : NaN;

    // Entradas x saídas: por dia (até 62 dias) ou por mês
    const dias = diasEntre(p.inicio, p.fim);
    const porMes = dias.length > 62;
    const chaveTempo = (iso) => (porMes ? iso.slice(0, 7) : iso);
    const baldes = new Map();
    for (const d of dias) {
      const k = chaveTempo(d);
      if (!baldes.has(k)) baldes.set(k, { k, entradas: 0, saidas: 0 });
    }
    for (const v of V) {
      const b = baldes.get(chaveTempo(v.data));
      if (b) { b.entradas += Number(v.valor_recebido); b.saidas += Number(v.taxa_reais); }
    }
    for (const c of C) {
      const b = baldes.get(chaveTempo(c.data));
      if (b) b.saidas += Number(c.valor_total);
    }
    const tempo = [...baldes.values()].map((b) => ({
      ...b,
      rotulo: porMes ? `${MESES[Number(b.k.slice(5, 7)) - 1]}/${b.k.slice(2, 4)}` : dataBR(b.k).slice(0, 5),
      completo: porMes ? `${MESES[Number(b.k.slice(5, 7)) - 1]}/${b.k.slice(0, 4)}` : dataBR(b.k),
    }));

    return {
      faturamento, taxas, gastos, lucro, margem, tempo, porMes,
      categorias: agrupar(C, (c) => c.categorias?.nome || 'Sem categoria', (c) => Number(c.valor_total)),
      canais: agrupar(V, (v) => v.canal, (v) => Number(v.valor_recebido)),
      produtos: agrupar(V, (v) => v.produto_nome, (v) => Number(v.quantidade)).slice(0, 8),
    };
  }, [vendas.linhas, compras.linhas, p.inicio, p.fim]);

  return (
    <section>
      <div className="titulo-secao">
        <h1>Balanço</h1>
      </div>
      <div className="barra-ferramentas"><FiltroPeriodo p={p} /></div>
      <Aviso tipo="erro">{vendas.erro || compras.erro}</Aviso>
      {carregando ? <Carregando /> : (
        <>
          <div className="cartoes">
            <Cartao titulo="Faturamento" valor={moeda(r.faturamento)} />
            <Cartao titulo="Total de gastos" valor={moeda(r.gastos)} />
            <Cartao titulo="Taxas pagas" valor={moeda(r.taxas)} />
            <Cartao titulo="Lucro líquido" valor={moeda(r.lucro)} destaque tom={r.lucro >= 0 ? 'bom' : 'ruim'} />
            <Cartao titulo="Margem de lucro" valor={porcentagem(r.margem)} tom={r.margem >= 0 ? 'bom' : r.margem < 0 ? 'ruim' : undefined} />
          </div>
          <p className="nota">Lucro líquido = faturamento − gastos − taxas. Margem = lucro líquido ÷ faturamento.</p>

          <div className="graficos">
            <Grafico titulo={`Entradas x saídas ${r.porMes ? 'por mês' : 'por dia'}`} largo vazio={!r.faturamento && !r.gastos && !r.taxas}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={r.tempo} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
                  <CartesianGrid vertical={false} stroke="var(--grade)" />
                  <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: 'var(--texto-2)' }} tickLine={false} axisLine={{ stroke: 'var(--borda)' }} minTickGap={8} />
                  <YAxis tickFormatter={moedaCurta} tick={{ fontSize: 11, fill: 'var(--texto-2)' }} tickLine={false} axisLine={false} width={72} />
                  <Tooltip content={<Dica rotuloDe={(d) => d.completo} />} cursor={{ fill: 'var(--hover)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 13 }} />
                  <Bar dataKey="entradas" name="Entradas (vendas)" fill={COR_ENTRADA} radius={[4, 4, 0, 0]} maxBarSize={28} animationDuration={500} />
                  <Bar dataKey="saidas" name="Saídas (gastos + taxas)" fill={COR_SAIDA} radius={[4, 4, 0, 0]} maxBarSize={28} animationDuration={500} />
                </BarChart>
              </ResponsiveContainer>
            </Grafico>

            <Grafico titulo="Gastos por categoria" vazio={!r.categorias.length}>
              <BarrasHorizontais dados={r.categorias} formato={moeda} />
            </Grafico>

            <Grafico titulo="Vendas por canal (R$)" vazio={!r.canais.length}>
              <BarrasHorizontais dados={r.canais} formato={moeda} />
            </Grafico>

            <Grafico titulo="Produtos mais vendidos (unidades)" largo vazio={!r.produtos.length}>
              <BarrasHorizontais dados={r.produtos} formato={(v) => `${numero(v)} un`} />
            </Grafico>
          </div>
        </>
      )}
    </section>
  );
}

function Cartao({ titulo, valor, destaque, tom }) {
  return (
    <div className={`cartao${destaque ? ' cartao-destaque' : ''}${tom ? ` tom-${tom}` : ''}`}>
      <span className="cartao-titulo">{titulo}</span>
      <span className="cartao-valor">{valor}</span>
    </div>
  );
}

function Grafico({ titulo, children, largo, vazio }) {
  return (
    <div className={`painel${largo ? ' painel-largo' : ''}`}>
      <h2>{titulo}</h2>
      {vazio ? <Vazio>Sem dados neste período.</Vazio> : children}
    </div>
  );
}

function BarrasHorizontais({ dados, formato }) {
  const altura = Math.max(120, dados.length * 40 + 20);
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 90, left: 0, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 12, fill: 'var(--texto)' }} tickLine={false} axisLine={false} />
        <Tooltip content={<Dica formato={formato} rotuloDe={(d) => d.nome} />} cursor={{ fill: 'var(--hover)' }} />
        <Bar dataKey="total" name="Total" fill={COR_BARRA} radius={[0, 4, 4, 0]} maxBarSize={24} animationDuration={500}
          label={{ position: 'right', formatter: formato, fontSize: 12, fill: 'var(--texto-2)' }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Dica({ active, payload, rotuloDe, formato = moeda }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="dica-grafico">
      <strong>{rotuloDe(payload[0].payload)}</strong>
      {payload.map((p) => (
        <div key={p.dataKey}>
          <span className="bolinha" style={{ background: p.color || p.fill }} /> {p.name}: <strong>{formato(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}
