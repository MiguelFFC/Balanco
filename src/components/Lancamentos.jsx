import { useMemo, useState } from 'react';
import { supabase, mensagemErro } from '../lib/supabase';
import { useDados } from '../lib/dados';
import { useLancamentos } from '../lib/hooks';
import { baixarCSV } from '../lib/csv';
import { moeda, numero, dataBR, hojeISO, lerNumero, paraCampo, normalizar } from '../lib/format';
import { CANAIS, FORMAS_PAGAMENTO, UNIDADES_LIVRES } from '../lib/calculos';
import { Aviso, Campo, CampoNumero, Carregando, FiltroPeriodo, Modal, Vazio, usePeriodo } from './ui';

export default function Lancamentos() {
  const [sub, setSub] = useState('vendas');
  return (
    <section>
      <div className="titulo-secao">
        <h1>Lançamentos</h1>
        <div className="segmentado" role="tablist">
          <button type="button" role="tab" aria-selected={sub === 'vendas'} className={sub === 'vendas' ? 'ativo' : ''} onClick={() => setSub('vendas')}>Vendas</button>
          <button type="button" role="tab" aria-selected={sub === 'compras'} className={sub === 'compras' ? 'ativo' : ''} onClick={() => setSub('compras')}>Compras (gastos)</button>
        </div>
      </div>
      {sub === 'vendas' ? <ListaVendas /> : <ListaCompras />}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Lista genérica                                                       */
/* ------------------------------------------------------------------ */

function useLista(tabela, textoBusca) {
  const { versao } = useDados();
  const p = usePeriodo('mes');
  const [busca, setBusca] = useState('');
  const dados = useLancamentos(tabela, p.inicio, p.fim, versao);
  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    if (!termo) return dados.linhas;
    return dados.linhas.filter((l) => normalizar(textoBusca(l)).includes(termo));
  }, [busca, dados.linhas, textoBusca]);
  return { p, busca, setBusca, ...dados, filtradas };
}

async function excluir(tabela, id, recarregar, setMsg) {
  if (!confirm('Excluir este lançamento? Essa ação não pode ser desfeita.')) return;
  const { error } = await supabase.from(tabela).delete().eq('id', id);
  if (error) return setMsg({ tipo: 'erro', texto: mensagemErro(error) });
  setMsg({ tipo: 'ok', texto: 'Lançamento excluído.' });
  recarregar();
}

function Barra({ l, rotuloNovo, onNovo, onExportar }) {
  return (
    <div className="barra-ferramentas">
      <FiltroPeriodo p={l.p} />
      <div className="barra-linha">
        <input type="search" className="busca" placeholder="Buscar…" value={l.busca} onChange={(e) => l.setBusca(e.target.value)} aria-label="Buscar" />
        <button type="button" className="btn btn-fantasma" onClick={onExportar} disabled={!l.filtradas.length}>⬇ Exportar CSV</button>
        <button type="button" className="btn btn-primario" onClick={onNovo}>+ {rotuloNovo}</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* VENDAS                                                               */
/* ------------------------------------------------------------------ */

const textoVenda = (v) => [v.produto_nome, v.canal, v.forma_pagamento, v.observacao].join(' ');

function ListaVendas() {
  const l = useLista('vendas', textoVenda);
  const [editando, setEditando] = useState(null);
  const [msg, setMsg] = useState(null);

  const tot = l.filtradas.reduce(
    (a, v) => ({ valor: a.valor + Number(v.valor_recebido), taxa: a.taxa + Number(v.taxa_reais), qtd: a.qtd + Number(v.quantidade) }),
    { valor: 0, taxa: 0, qtd: 0 }
  );

  function exportar() {
    baixarCSV(`vendas_${l.p.inicio}_a_${l.p.fim}.csv`, [
      { titulo: 'Data', valor: (v) => dataBR(v.data) },
      { titulo: 'Produto', valor: (v) => v.produto_nome },
      { titulo: 'Quantidade', valor: (v) => Number(v.quantidade) },
      { titulo: 'Valor recebido (R$)', valor: (v) => Number(v.valor_recebido) },
      { titulo: 'Canal', valor: (v) => v.canal },
      { titulo: 'Taxa informada', valor: (v) => (v.taxa_tipo === 'pct' ? `${paraCampo(v.taxa_valor)}%` : `R$ ${paraCampo(v.taxa_valor)}`) },
      { titulo: 'Taxa (R$)', valor: (v) => Number(v.taxa_reais) },
      { titulo: 'Líquido (R$)', valor: (v) => Number(v.valor_recebido) - Number(v.taxa_reais) },
      { titulo: 'Forma de pagamento', valor: (v) => v.forma_pagamento },
      { titulo: 'Observação', valor: (v) => v.observacao },
    ], l.filtradas);
  }

  return (
    <>
      <Barra l={l} rotuloNovo="Nova venda" onNovo={() => setEditando({})} onExportar={exportar} />
      {msg && <Aviso tipo={msg.tipo} onFechar={() => setMsg(null)}>{msg.texto}</Aviso>}
      <Aviso tipo="erro">{l.erro}</Aviso>
      <div className="resumo-lista">
        <span><strong>{l.filtradas.length}</strong> vendas</span>
        <span><strong>{numero(tot.qtd)}</strong> itens</span>
        <span>Recebido <strong>{moeda(tot.valor)}</strong></span>
        <span>Taxas <strong>{moeda(tot.taxa)}</strong></span>
      </div>
      {l.carregando ? <Carregando /> : !l.filtradas.length ? (
        <Vazio>Nenhuma venda neste período. Clique em <strong>+ Nova venda</strong>.</Vazio>
      ) : (
        <ul className="lista">
          {l.filtradas.map((v) => (
            <li key={v.id} className="item">
              <div className="item-principal">
                <span className="item-data">{dataBR(v.data)}</span>
                <span className="item-titulo">{numero(v.quantidade)}× {v.produto_nome}</span>
                <span className="item-detalhe">
                  <span className={`etiqueta etq-${normalizar(v.canal)}`}>{v.canal}</span>
                  {v.forma_pagamento && <span>{v.forma_pagamento}</span>}
                  {Number(v.taxa_reais) > 0 && <span>taxa {moeda(v.taxa_reais)}</span>}
                  {v.observacao && <span className="item-obs">“{v.observacao}”</span>}
                </span>
              </div>
              <div className="item-valor positivo">{moeda(v.valor_recebido)}</div>
              <div className="item-acoes">
                <button type="button" className="btn-icone" onClick={() => setEditando(v)} aria-label="Editar">✏️</button>
                <button type="button" className="btn-icone" onClick={() => excluir('vendas', v.id, l.recarregar, setMsg)} aria-label="Excluir">🗑️</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal titulo={editando?.id ? 'Editar venda' : 'Nova venda'} aberto={!!editando} onFechar={() => setEditando(null)}>
        {editando && (
          <FormVenda
            venda={editando}
            onSalvo={(texto) => { setEditando(null); setMsg({ tipo: 'ok', texto }); l.recarregar(); }}
            onCancelar={() => setEditando(null)}
          />
        )}
      </Modal>
    </>
  );
}

function FormVenda({ venda, onSalvo, onCancelar }) {
  const { produtos, config } = useDados();
  const novo = !venda.id;
  const [f, setF] = useState(() => ({
    data: venda.data || hojeISO(),
    produto_id: venda.id ? (venda.produto_id ? String(venda.produto_id) : 'outro') : (produtos[0] ? String(produtos[0].id) : 'outro'),
    produto_nome: venda.produto_nome || '',
    quantidade: paraCampo(venda.quantidade ?? 1),
    valor_recebido: paraCampo(venda.valor_recebido ?? (produtos[0]?.preco_venda ?? '')),
    canal: venda.canal || 'Balcão',
    taxa_tipo: venda.taxa_tipo || 'reais',
    taxa_valor: paraCampo(venda.taxa_valor ?? 0),
    forma_pagamento: venda.forma_pagamento || 'Pix',
    observacao: venda.observacao || '',
  }));
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [erroGeral, setErroGeral] = useState('');

  const produtoSel = produtos.find((p) => String(p.id) === f.produto_id);

  // Sugere a taxa conforme canal e forma de pagamento
  function taxaPadrao(canal, forma) {
    if (canal === 'iFood') return { taxa_tipo: 'pct', taxa_valor: paraCampo(config?.taxa_ifood_pct ?? 0) };
    if (/cart[aã]o/i.test(forma)) return { taxa_tipo: 'pct', taxa_valor: paraCampo(config?.taxa_cartao_pct ?? 0) };
    return { taxa_tipo: 'reais', taxa_valor: '0' };
  }

  function mudar(campo, valor) {
    setF((atual) => {
      const n = { ...atual, [campo]: valor };
      if (campo === 'produto_id' || campo === 'quantidade') {
        const prod = produtos.find((p) => String(p.id) === n.produto_id);
        const q = lerNumero(n.quantidade);
        if (prod && q > 0) n.valor_recebido = paraCampo(Math.round(prod.preco_venda * q * 100) / 100);
      }
      if (campo === 'canal' || campo === 'forma_pagamento') Object.assign(n, taxaPadrao(n.canal, n.forma_pagamento));
      return n;
    });
  }

  const valorNum = lerNumero(f.valor_recebido);
  const taxaNum = lerNumero(f.taxa_valor);
  const taxaReais = f.taxa_tipo === 'pct' ? (valorNum * taxaNum) / 100 : taxaNum;

  async function salvar(e) {
    e.preventDefault();
    const er = {};
    if (!f.data) er.data = 'Informe a data.';
    const nome = f.produto_id === 'outro' ? f.produto_nome.trim() : produtoSel?.nome;
    if (!nome) er.produto_nome = 'Informe o produto.';
    const q = lerNumero(f.quantidade);
    if (!(q > 0)) er.quantidade = 'Quantidade deve ser maior que zero.';
    if (!(valorNum >= 0)) er.valor_recebido = 'Informe um valor válido (não negativo).';
    if (!(taxaNum >= 0)) er.taxa_valor = 'Taxa não pode ser negativa.';
    else if (f.taxa_tipo === 'pct' && taxaNum > 100) er.taxa_valor = 'Porcentagem máxima é 100%.';
    else if (valorNum >= 0 && taxaReais > valorNum) er.taxa_valor = 'A taxa é maior que o valor recebido.';
    setErros(er);
    if (Object.keys(er).length) return;

    const registro = {
      data: f.data,
      produto_id: f.produto_id === 'outro' ? null : Number(f.produto_id),
      produto_nome: nome,
      quantidade: q,
      valor_recebido: valorNum,
      canal: f.canal,
      taxa_tipo: f.taxa_tipo,
      taxa_valor: taxaNum,
      forma_pagamento: f.forma_pagamento,
      observacao: f.observacao.trim() || null,
    };
    setSalvando(true);
    const { error } = novo
      ? await supabase.from('vendas').insert(registro)
      : await supabase.from('vendas').update(registro).eq('id', venda.id);
    setSalvando(false);
    if (error) return setErroGeral(mensagemErro(error));
    onSalvo(novo ? 'Venda registrada!' : 'Venda atualizada!');
  }

  return (
    <form onSubmit={salvar} noValidate className="form-grade">
      <Aviso tipo="erro">{erroGeral}</Aviso>
      <Campo rotulo="Data" erro={erros.data}>
        <input type="date" value={f.data} onChange={(e) => mudar('data', e.target.value)} />
      </Campo>
      <Campo rotulo="Produto" erro={f.produto_id !== 'outro' ? erros.produto_nome : undefined}>
        <select value={f.produto_id} onChange={(e) => mudar('produto_id', e.target.value)}>
          {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome} — {moeda(p.preco_venda)}</option>)}
          <option value="outro">Outro (digitar)</option>
        </select>
      </Campo>
      {f.produto_id === 'outro' && (
        <Campo rotulo="Nome do produto" erro={erros.produto_nome} largo>
          <input value={f.produto_nome} onChange={(e) => mudar('produto_nome', e.target.value)} placeholder="Ex.: Combo 2 açaís" />
        </Campo>
      )}
      <Campo rotulo="Quantidade" erro={erros.quantidade}>
        <CampoNumero value={f.quantidade} onChange={(v) => mudar('quantidade', v)} />
      </Campo>
      <Campo rotulo="Valor recebido" erro={erros.valor_recebido} dica={produtoSel ? 'Preenchido pelo preço do produto — ajuste se deu desconto.' : undefined}>
        <CampoNumero prefixo="R$" value={f.valor_recebido} onChange={(v) => mudar('valor_recebido', v)} />
      </Campo>
      <Campo rotulo="Canal de venda">
        <select value={f.canal} onChange={(e) => mudar('canal', e.target.value)}>
          {CANAIS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Forma de pagamento">
        <select value={f.forma_pagamento} onChange={(e) => mudar('forma_pagamento', e.target.value)}>
          {FORMAS_PAGAMENTO.map((c) => <option key={c}>{c}</option>)}
        </select>
      </Campo>
      <Campo
        rotulo="Taxa do canal/cartão"
        erro={erros.taxa_valor}
        dica={f.taxa_tipo === 'pct' && taxaReais >= 0 ? `= ${moeda(taxaReais)}` : undefined}
      >
        <div className="taxa-linha">
          <div className="segmentado segmentado-pq">
            <button type="button" className={f.taxa_tipo === 'reais' ? 'ativo' : ''} onClick={() => mudar('taxa_tipo', 'reais')}>R$</button>
            <button type="button" className={f.taxa_tipo === 'pct' ? 'ativo' : ''} onClick={() => mudar('taxa_tipo', 'pct')}>%</button>
          </div>
          <CampoNumero value={f.taxa_valor} onChange={(v) => mudar('taxa_valor', v)} />
        </div>
      </Campo>
      <Campo rotulo="Observação" largo>
        <input value={f.observacao} onChange={(e) => mudar('observacao', e.target.value)} placeholder="Opcional" />
      </Campo>
      <div className="form-acoes">
        <button type="button" className="btn btn-fantasma" onClick={onCancelar}>Cancelar</button>
        <button className="btn btn-primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar venda'}</button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* COMPRAS                                                              */
/* ------------------------------------------------------------------ */

const textoCompra = (c) => [c.item, c.fornecedor, c.categorias?.nome, c.forma_pagamento, c.observacao].join(' ');

function ListaCompras() {
  const l = useLista('compras', textoCompra);
  const [editando, setEditando] = useState(null);
  const [msg, setMsg] = useState(null);
  const total = l.filtradas.reduce((a, c) => a + Number(c.valor_total), 0);

  function exportar() {
    baixarCSV(`compras_${l.p.inicio}_a_${l.p.fim}.csv`, [
      { titulo: 'Data', valor: (c) => dataBR(c.data) },
      { titulo: 'Item', valor: (c) => c.item },
      { titulo: 'Fornecedor', valor: (c) => c.fornecedor },
      { titulo: 'Categoria', valor: (c) => c.categorias?.nome || 'Sem categoria' },
      { titulo: 'Quantidade', valor: (c) => Number(c.quantidade) },
      { titulo: 'Unidade', valor: (c) => c.unidade },
      { titulo: 'Valor total (R$)', valor: (c) => Number(c.valor_total) },
      { titulo: 'Forma de pagamento', valor: (c) => c.forma_pagamento },
      { titulo: 'Observação', valor: (c) => c.observacao },
    ], l.filtradas);
  }

  return (
    <>
      <Barra l={l} rotuloNovo="Nova compra" onNovo={() => setEditando({})} onExportar={exportar} />
      {msg && <Aviso tipo={msg.tipo} onFechar={() => setMsg(null)}>{msg.texto}</Aviso>}
      <Aviso tipo="erro">{l.erro}</Aviso>
      <div className="resumo-lista">
        <span><strong>{l.filtradas.length}</strong> compras</span>
        <span>Total gasto <strong>{moeda(total)}</strong></span>
      </div>
      {l.carregando ? <Carregando /> : !l.filtradas.length ? (
        <Vazio>Nenhuma compra neste período. Clique em <strong>+ Nova compra</strong>.</Vazio>
      ) : (
        <ul className="lista">
          {l.filtradas.map((c) => (
            <li key={c.id} className="item">
              <div className="item-principal">
                <span className="item-data">{dataBR(c.data)}</span>
                <span className="item-titulo">{c.item}</span>
                <span className="item-detalhe">
                  <span className="etiqueta">{c.categorias?.nome || 'Sem categoria'}</span>
                  <span>{numero(c.quantidade, 3)} {c.unidade}</span>
                  {c.fornecedor && <span>{c.fornecedor}</span>}
                  {c.forma_pagamento && <span>{c.forma_pagamento}</span>}
                  {c.observacao && <span className="item-obs">“{c.observacao}”</span>}
                </span>
              </div>
              <div className="item-valor negativo">−{moeda(c.valor_total)}</div>
              <div className="item-acoes">
                <button type="button" className="btn-icone" onClick={() => setEditando(c)} aria-label="Editar">✏️</button>
                <button type="button" className="btn-icone" onClick={() => excluir('compras', c.id, l.recarregar, setMsg)} aria-label="Excluir">🗑️</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal titulo={editando?.id ? 'Editar compra' : 'Nova compra'} aberto={!!editando} onFechar={() => setEditando(null)}>
        {editando && (
          <FormCompra
            compra={editando}
            onSalvo={(texto) => { setEditando(null); setMsg({ tipo: 'ok', texto }); l.recarregar(); }}
            onCancelar={() => setEditando(null)}
          />
        )}
      </Modal>
    </>
  );
}

function FormCompra({ compra, onSalvo, onCancelar }) {
  const { categorias, atualizar } = useDados();
  const novo = !compra.id;
  const [f, setF] = useState(() => ({
    data: compra.data || hojeISO(),
    item: compra.item || '',
    fornecedor: compra.fornecedor || '',
    categoria_id: compra.categoria_id ? String(compra.categoria_id) : String(categorias[0]?.id ?? ''),
    quantidade: paraCampo(compra.quantidade ?? 1),
    unidade: compra.unidade || 'un',
    valor_total: paraCampo(compra.valor_total ?? ''),
    forma_pagamento: compra.forma_pagamento || 'Pix',
    observacao: compra.observacao || '',
  }));
  const [novaCat, setNovaCat] = useState(null);
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [erroGeral, setErroGeral] = useState('');
  const mudar = (campo, valor) => setF((a) => ({ ...a, [campo]: valor }));

  async function criarCategoria() {
    const nome = (novaCat || '').trim();
    if (!nome) return setErros((e) => ({ ...e, categoria: 'Digite o nome da categoria.' }));
    const { data, error } = await supabase.from('categorias').insert({ nome }).select().single();
    if (error) return setErros((e) => ({ ...e, categoria: mensagemErro(error) }));
    await atualizar();
    mudar('categoria_id', String(data.id));
    setNovaCat(null);
    setErros((e) => ({ ...e, categoria: undefined }));
  }

  async function salvar(e) {
    e.preventDefault();
    const er = {};
    if (!f.data) er.data = 'Informe a data.';
    if (!f.item.trim()) er.item = 'Informe o que foi comprado.';
    const q = lerNumero(f.quantidade);
    if (!(q > 0)) er.quantidade = 'Quantidade deve ser maior que zero.';
    const v = lerNumero(f.valor_total);
    if (!(v >= 0) || f.valor_total === '') er.valor_total = 'Informe um valor válido (não negativo).';
    if (!f.categoria_id) er.categoria = 'Escolha uma categoria.';
    if (!f.unidade.trim()) er.unidade = 'Informe a unidade.';
    setErros(er);
    if (Object.keys(er).length) return;

    const registro = {
      data: f.data,
      item: f.item.trim(),
      fornecedor: f.fornecedor.trim() || null,
      categoria_id: Number(f.categoria_id),
      quantidade: q,
      unidade: f.unidade.trim(),
      valor_total: v,
      forma_pagamento: f.forma_pagamento,
      observacao: f.observacao.trim() || null,
    };
    setSalvando(true);
    const { error } = novo
      ? await supabase.from('compras').insert(registro)
      : await supabase.from('compras').update(registro).eq('id', compra.id);
    setSalvando(false);
    if (error) return setErroGeral(mensagemErro(error));
    onSalvo(novo ? 'Compra registrada!' : 'Compra atualizada!');
  }

  return (
    <form onSubmit={salvar} noValidate className="form-grade">
      <Aviso tipo="erro">{erroGeral}</Aviso>
      <Campo rotulo="Data" erro={erros.data}>
        <input type="date" value={f.data} onChange={(e) => mudar('data', e.target.value)} />
      </Campo>
      <Campo rotulo="Item" erro={erros.item}>
        <input value={f.item} onChange={(e) => mudar('item', e.target.value)} placeholder="Ex.: Balde de açaí 10 kg" />
      </Campo>
      <Campo rotulo="Fornecedor">
        <input value={f.fornecedor} onChange={(e) => mudar('fornecedor', e.target.value)} placeholder="Opcional" />
      </Campo>
      <Campo rotulo="Categoria" erro={erros.categoria}>
        {novaCat === null ? (
          <div className="linha-inline">
            <select value={f.categoria_id} onChange={(e) => mudar('categoria_id', e.target.value)}>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <button type="button" className="btn btn-fantasma btn-pq" onClick={() => setNovaCat('')}>+ Nova</button>
          </div>
        ) : (
          <div className="linha-inline">
            <input autoFocus value={novaCat} onChange={(e) => setNovaCat(e.target.value)} placeholder="Nome da categoria"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), criarCategoria())} />
            <button type="button" className="btn btn-primario btn-pq" onClick={criarCategoria}>Criar</button>
            <button type="button" className="btn-icone" onClick={() => setNovaCat(null)} aria-label="Cancelar">✕</button>
          </div>
        )}
      </Campo>
      <Campo rotulo="Quantidade" erro={erros.quantidade}>
        <CampoNumero value={f.quantidade} onChange={(v) => mudar('quantidade', v)} />
      </Campo>
      <Campo rotulo="Unidade" erro={erros.unidade}>
        <input list="unidades" value={f.unidade} onChange={(e) => mudar('unidade', e.target.value)} />
        <datalist id="unidades">{UNIDADES_LIVRES.map((u) => <option key={u} value={u} />)}</datalist>
      </Campo>
      <Campo rotulo="Valor total" erro={erros.valor_total}>
        <CampoNumero prefixo="R$" value={f.valor_total} onChange={(v) => mudar('valor_total', v)} placeholder="0,00" />
      </Campo>
      <Campo rotulo="Forma de pagamento">
        <select value={f.forma_pagamento} onChange={(e) => mudar('forma_pagamento', e.target.value)}>
          {FORMAS_PAGAMENTO.map((c) => <option key={c}>{c}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Observação" largo>
        <input value={f.observacao} onChange={(e) => mudar('observacao', e.target.value)} placeholder="Opcional" />
      </Campo>
      <div className="form-acoes">
        <button type="button" className="btn btn-fantasma" onClick={onCancelar}>Cancelar</button>
        <button className="btn btn-primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar compra'}</button>
      </div>
    </form>
  );
}
