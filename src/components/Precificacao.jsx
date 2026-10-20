import { useMemo, useState } from 'react';
import { supabase, mensagemErro } from '../lib/supabase';
import { useDados } from '../lib/dados';
import { moeda, numero, porcentagem, lerNumero, paraCampo } from '../lib/format';
import { UNIDADES_COMPRA, unidadeCompra, custoUnitario, custosProduto, precoSugerido, analisarPreco, formatarQtd, situacaoEstoque } from '../lib/calculos';
import { Aviso, Campo, CampoNumero, Modal, Vazio } from './ui';

export default function Precificacao() {
  const [msg, setMsg] = useState(null);
  return (
    <section>
      <div className="titulo-secao"><h1>Precificação</h1></div>
      {msg && <Aviso tipo={msg.tipo} onFechar={() => setMsg(null)}>{msg.texto}</Aviso>}
      <Taxas setMsg={setMsg} />
      <Produtos setMsg={setMsg} />
      <Calculadora />
      <Insumos setMsg={setMsg} />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Taxas padrão (iFood e cartão)                                        */
/* ------------------------------------------------------------------ */

function Taxas({ setMsg }) {
  const { config, atualizar } = useDados();
  const [ifood, setIfood] = useState(paraCampo(config?.taxa_ifood_pct ?? 27));
  const [cartao, setCartao] = useState(paraCampo(config?.taxa_cartao_pct ?? 3.5));
  const [erro, setErro] = useState('');

  async function salvar() {
    const a = lerNumero(ifood);
    const b = lerNumero(cartao);
    if (!(a >= 0 && a <= 100) || !(b >= 0 && b <= 100)) return setErro('As taxas devem estar entre 0% e 100%.');
    setErro('');
    const { error } = await supabase.from('configuracoes').update({ taxa_ifood_pct: a, taxa_cartao_pct: b }).eq('user_id', config.user_id);
    if (error) return setErro(mensagemErro(error));
    await atualizar();
    setMsg({ tipo: 'ok', texto: 'Taxas salvas. Elas também são sugeridas automaticamente ao lançar vendas.' });
  }

  return (
    <div className="painel">
      <h2>Taxas que você paga</h2>
      <p className="nota">Usadas para calcular o lucro "de verdade" de cada produto e para preencher a taxa nas vendas.</p>
      <div className="form-grade form-grade-3">
        <Campo rotulo="Taxa do iFood" erro={erro && ' '}>
          <CampoNumero sufixo="%" value={ifood} onChange={setIfood} />
        </Campo>
        <Campo rotulo="Taxa da maquininha (cartão)" erro={erro && ' '}>
          <CampoNumero sufixo="%" value={cartao} onChange={setCartao} />
        </Campo>
        <div className="campo campo-botao">
          <button type="button" className="btn btn-primario" onClick={salvar}>Salvar taxas</button>
        </div>
      </div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Produtos (ficha técnica)                                             */
/* ------------------------------------------------------------------ */

function Produtos({ setMsg }) {
  const { produtos, composicao, insumosPorId, config, atualizar } = useDados();
  const [editando, setEditando] = useState(null);
  const [aberto, setAberto] = useState(null);
  const tIfood = Number(config?.taxa_ifood_pct ?? 0);
  const tCartao = Number(config?.taxa_cartao_pct ?? 0);

  async function excluir(p) {
    if (!confirm(`Excluir o produto "${p.nome}"? As vendas já lançadas continuam.`)) return;
    const { error } = await supabase.from('produtos').delete().eq('id', p.id);
    if (error) return setMsg({ tipo: 'erro', texto: mensagemErro(error) });
    await atualizar();
    setMsg({ tipo: 'ok', texto: 'Produto excluído.' });
  }

  return (
    <div className="painel">
      <div className="painel-topo">
        <h2>Produtos e ficha técnica</h2>
        <button type="button" className="btn btn-primario" onClick={() => setEditando({})}>+ Novo produto</button>
      </div>
      {!produtos.length ? <Vazio>Nenhum produto cadastrado. Cadastre os insumos primeiro e depois os produtos.</Vazio> : (
        <div className="produtos">
          {produtos.map((p) => {
            const c = custosProduto(p, composicao, insumosPorId);
            const custo = c.medio;
            const preco = Number(p.preco_venda);
            const a = analisarPreco(preco, custo, 0);
            const ai = analisarPreco(preco, custo, tIfood);
            const ac = analisarPreco(preco, custo, tCartao);
            const itens = composicao.filter((c) => c.produto_id === p.id);
            return (
              <div key={p.id} className="produto">
                <div className="produto-topo">
                  <h3>{p.nome}</h3>
                  <div className="item-acoes">
                    <button type="button" className="btn-icone" onClick={() => setEditando(p)} aria-label="Editar">✏️</button>
                    <button type="button" className="btn-icone" onClick={() => excluir(p)} aria-label="Excluir">🗑️</button>
                  </div>
                </div>
                <dl className="produto-numeros">
                  <div><dt>Preço de venda</dt><dd>{moeda(preco)}</dd></div>
                  <div><dt>{c.qtdAcomp ? 'Custo médio' : 'Custo'}</dt><dd>{moeda(custo)}</dd></div>
                  <div><dt>Lucro</dt><dd className={a.lucro >= 0 ? 'positivo' : 'negativo'}>{moeda(a.lucro)}</dd></div>
                  <div><dt>Margem</dt><dd className={a.margem >= 0 ? 'positivo' : 'negativo'}>{porcentagem(a.margem)}</dd></div>
                  <div><dt>Lucro no iFood ({numero(tIfood)}%)</dt><dd className={ai.lucroComTaxa >= 0 ? 'positivo' : 'negativo'}>{moeda(ai.lucroComTaxa)} <small>({porcentagem(ai.margemComTaxa)})</small></dd></div>
                  <div><dt>Lucro no cartão ({numero(tCartao)}%)</dt><dd className={ac.lucroComTaxa >= 0 ? 'positivo' : 'negativo'}>{moeda(ac.lucroComTaxa)} <small>({porcentagem(ac.margemComTaxa)})</small></dd></div>
                </dl>
                {c.totalAcomps > 0 && (
                  <p className="nota nota-produto">
                    Base {moeda(c.fixo)} + {c.qtdAcomp} acompanhamento(s) inclusos · custo vai de {moeda(c.minimo)} a {moeda(c.maximo)}
                  </p>
                )}
                <button type="button" className="link" onClick={() => setAberto(aberto === p.id ? null : p.id)}>
                  {aberto === p.id ? '▾ Esconder' : '▸ Ver'} composição ({itens.length} insumos)
                </button>
                {aberto === p.id && (
                  <table className="tabela-comp">
                    <thead><tr><th>Insumo</th><th>Qtd.</th><th>Custo</th></tr></thead>
                    <tbody>
                      {[...itens].sort((a, b) => (a.tipo === 'acompanhamento') - (b.tipo === 'acompanhamento')).map((c) => {
                        const i = insumosPorId[c.insumo_id];
                        return (
                          <tr key={c.id}>
                            <td>{i?.nome} {c.tipo === 'acompanhamento' && <span className="etiqueta etq-acomp">acomp.</span>}</td>
                            <td>{numero(c.quantidade, 3)} {i?.unidade_base}</td>
                            <td>{moeda(Number(c.quantidade) * custoUnitario(i))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Modal titulo={editando?.id ? 'Editar produto' : 'Novo produto'} aberto={!!editando} onFechar={() => setEditando(null)}>
        {editando && (
          <FormProduto
            produto={editando}
            onSalvo={(texto) => { setEditando(null); setMsg({ tipo: 'ok', texto }); }}
            onCancelar={() => setEditando(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function FormProduto({ produto, onSalvo, onCancelar }) {
  const { insumos, insumosPorId, composicao, config, atualizar } = useDados();
  const novo = !produto.id;
  const [nome, setNome] = useState(produto.nome || '');
  const [preco, setPreco] = useState(paraCampo(produto.preco_venda ?? ''));
  const [linhas, setLinhas] = useState(() =>
    novo ? [] : composicao.filter((c) => c.produto_id === produto.id)
      .map((c) => ({ insumo_id: String(c.insumo_id), quantidade: paraCampo(c.quantidade), tipo: c.tipo || 'fixo' }))
  );
  const [qtdAcomp, setQtdAcomp] = useState(String(produto.qtd_acompanhamentos ?? 3));
  const [margem, setMargem] = useState('50');
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [salvando, setSalvando] = useState(false);

  const custos = custosProduto(
    { id: 'form', qtd_acompanhamentos: Math.max(0, Math.floor(lerNumero(qtdAcomp)) || 0) },
    linhas.map((l) => ({ produto_id: 'form', insumo_id: Number(l.insumo_id), tipo: l.tipo, quantidade: lerNumero(l.quantidade) > 0 ? lerNumero(l.quantidade) : 0 })),
    insumosPorId
  );
  const custo = custos.medio;
  const precoNum = lerNumero(preco);
  const a = analisarPreco(precoNum > 0 ? precoNum : 0, custo, Number(config?.taxa_ifood_pct ?? 0));
  const sugerido = precoSugerido(custo, lerNumero(margem));

  const mudarLinha = (idx, campo, valor) => setLinhas((ls) => ls.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));
  const usados = new Set(linhas.map((l) => l.insumo_id));
  const adicionar = () => {
    const livre = insumos.find((i) => !usados.has(String(i.id)));
    if (livre) setLinhas((ls) => [...ls, { insumo_id: String(livre.id), quantidade: '', tipo: 'fixo' }]);
  };

  async function salvar(e) {
    e.preventDefault();
    const er = {};
    if (!nome.trim()) er.nome = 'Informe o nome do produto.';
    if (!(precoNum >= 0) || preco === '') er.preco = 'Informe um preço válido (não negativo).';
    linhas.forEach((l, i) => { if (!(lerNumero(l.quantidade) > 0)) er[`l${i}`] = 'Qtd. > 0'; });
    if (new Set(linhas.map((l) => l.insumo_id)).size !== linhas.length) er.linhas = 'Há insumos repetidos na composição.';
    const nAcomp = lerNumero(qtdAcomp);
    if (!(Number.isInteger(nAcomp) && nAcomp >= 0 && nAcomp <= 20)) er.qtdAcomp = 'Use um número inteiro de 0 a 20.';
    setErros(er);
    if (Object.keys(er).length) return;

    setSalvando(true);
    try {
      let id = produto.id;
      if (novo) {
        const { data, error } = await supabase.from('produtos').insert({ nome: nome.trim(), preco_venda: precoNum, qtd_acompanhamentos: nAcomp }).select().single();
        if (error) throw error;
        id = data.id;
      } else {
        const { error } = await supabase.from('produtos').update({ nome: nome.trim(), preco_venda: precoNum, qtd_acompanhamentos: nAcomp }).eq('id', id);
        if (error) throw error;
        const { error: e2 } = await supabase.from('produto_insumos').delete().eq('produto_id', id);
        if (e2) throw e2;
      }
      if (linhas.length) {
        const { error } = await supabase.from('produto_insumos').insert(
          linhas.map((l) => ({ produto_id: id, insumo_id: Number(l.insumo_id), quantidade: lerNumero(l.quantidade), tipo: l.tipo }))
        );
        if (error) throw error;
      }
      await atualizar();
      onSalvo(novo ? 'Produto cadastrado!' : 'Produto atualizado!');
    } catch (err) {
      setErroGeral(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} noValidate className="form-grade">
      <Aviso tipo="erro">{erroGeral}</Aviso>
      <Campo rotulo="Nome do produto" erro={erros.nome}>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Açaí 500ml" />
      </Campo>
      <Campo rotulo="Preço de venda" erro={erros.preco}>
        <CampoNumero prefixo="R$" value={preco} onChange={setPreco} placeholder="0,00" />
      </Campo>
      <Campo rotulo="Acompanhamentos inclusos no preço" erro={erros.qtdAcomp} dica="Quantos o cliente pode escolher sem pagar a mais (ex.: 3).">
        <CampoNumero value={qtdAcomp} onChange={setQtdAcomp} inputMode="numeric" />
      </Campo>

      <div className="campo-largo">
        <span className="campo-rotulo">Composição (o que vai em 1 unidade)</span>
        <span className="campo-dica">
          <strong>Fixo</strong> = vai em todo pedido (açaí, copo, tampa, colher). <strong>Acompanhamento</strong> = só vai se o cliente escolher; informe a porção usada neste tamanho.
        </span>
        {!insumos.length && <Vazio>Cadastre insumos primeiro (seção "Insumos" abaixo).</Vazio>}
        {linhas.map((l, idx) => {
          const i = insumosPorId[l.insumo_id];
          const q = lerNumero(l.quantidade);
          return (
            <div key={idx} className="comp-linha">
              <select value={l.insumo_id} onChange={(e) => mudarLinha(idx, 'insumo_id', e.target.value)} aria-label="Insumo">
                {insumos.filter((x) => String(x.id) === l.insumo_id || !usados.has(String(x.id))).map((x) => (
                  <option key={x.id} value={x.id}>{x.nome}</option>
                ))}
              </select>
              <select value={l.tipo} onChange={(e) => mudarLinha(idx, 'tipo', e.target.value)} aria-label="Tipo" className="comp-tipo">
                <option value="fixo">Fixo</option>
                <option value="acompanhamento">Acompanhamento</option>
              </select>
              <div className={erros[`l${idx}`] ? 'campo-erro' : ''}>
                <CampoNumero sufixo={i?.unidade_base} value={l.quantidade} onChange={(v) => mudarLinha(idx, 'quantidade', v)} placeholder="Qtd." aria-label="Quantidade" />
              </div>
              <span className="comp-custo">{moeda(q > 0 ? q * custoUnitario(i) : 0)}</span>
              <button type="button" className="btn-icone" onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== idx))} aria-label="Remover">✕</button>
            </div>
          );
        })}
        {erros.linhas && <span className="campo-msg-erro">{erros.linhas}</span>}
        {Object.keys(erros).some((k) => k.startsWith('l') && k !== 'linhas') && <span className="campo-msg-erro">Preencha todas as quantidades (maiores que zero).</span>}
        {insumos.length > usados.size && (
          <button type="button" className="btn btn-fantasma btn-pq" onClick={adicionar}>+ Adicionar insumo</button>
        )}
      </div>

      <div className="campo-largo resumo-produto">
        <div><span>Custo fixo</span><strong>{moeda(custos.fixo)}</strong></div>
        <div><span>Custo médio{custos.qtdAcomp ? ` (c/ ${custos.qtdAcomp} acomp.)` : ''}</span><strong>{moeda(custo)}</strong></div>
        <div><span>Lucro</span><strong className={a.lucro >= 0 ? 'positivo' : 'negativo'}>{moeda(a.lucro)}</strong></div>
        <div><span>Margem</span><strong>{porcentagem(a.margem)}</strong></div>
        <div><span>Lucro no iFood</span><strong className={a.lucroComTaxa >= 0 ? 'positivo' : 'negativo'}>{moeda(a.lucroComTaxa)}</strong></div>
      </div>
      <div className="campo-largo sugestao">
        <span>Quero margem de</span>
        <div className="w-pq"><CampoNumero sufixo="%" value={margem} onChange={setMargem} aria-label="Margem desejada" /></div>
        <span>→ preço sugerido (sem taxas) <strong>{sugerido ? moeda(sugerido) : '—'}</strong></span>
        {sugerido && <button type="button" className="btn btn-fantasma btn-pq" onClick={() => setPreco(paraCampo(Math.ceil(sugerido * 2) / 2))}>Usar</button>}
      </div>

      <div className="form-acoes">
        <button type="button" className="btn btn-fantasma" onClick={onCancelar}>Cancelar</button>
        <button className="btn btn-primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar produto'}</button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Calculadora de preço sugerido                                        */
/* ------------------------------------------------------------------ */

function Calculadora() {
  const { produtos, composicao, insumosPorId, config } = useDados();
  const [escolha, setFonte] = useState(produtos[0] ? String(produtos[0].id) : 'manual');
  const fonte = escolha === 'manual' || produtos.some((p) => String(p.id) === escolha) ? escolha : 'manual';
  const [custoManual, setCustoManual] = useState('');
  const [margem, setMargem] = useState('50');

  const produtoSel = produtos.find((p) => String(p.id) === fonte);
  const custo = fonte === 'manual' ? lerNumero(custoManual) : custosProduto(produtoSel, composicao, insumosPorId).medio;
  const m = lerNumero(margem);
  const valido = custo > 0 && m >= 0 && m < 100;
  const tIfood = Number(config?.taxa_ifood_pct ?? 0);
  const tCartao = Number(config?.taxa_cartao_pct ?? 0);
  const linhas = [
    { nome: 'Balcão / Pix / dinheiro (sem taxa)', taxa: 0 },
    { nome: `Cartão (${numero(tCartao)}%)`, taxa: tCartao },
    { nome: `iFood (${numero(tIfood)}%)`, taxa: tIfood },
  ];

  return (
    <div className="painel">
      <h2>Calculadora de preço sugerido</h2>
      <p className="nota">Informe a margem de lucro desejada (sobre o preço de venda) e veja o preço ideal para cada canal.</p>
      <div className="form-grade form-grade-3">
        <Campo rotulo="Produto">
          <select value={fonte} onChange={(e) => setFonte(e.target.value)}>
            {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            <option value="manual">Outro (digitar custo)</option>
          </select>
        </Campo>
        {fonte === 'manual' ? (
          <Campo rotulo="Custo do produto">
            <CampoNumero prefixo="R$" value={custoManual} onChange={setCustoManual} placeholder="0,00" />
          </Campo>
        ) : (
          <Campo rotulo="Custo médio do produto"><div className="valor-fixo">{moeda(custo)}</div></Campo>
        )}
        <Campo rotulo="Margem desejada" erro={margem !== '' && !(m >= 0 && m < 100) ? 'Use um valor entre 0% e 99%.' : undefined}>
          <CampoNumero sufixo="%" value={margem} onChange={setMargem} />
        </Campo>
      </div>
      {valido ? (
        <div className="sugestoes">
          {linhas.map((l) => {
            const p = precoSugerido(custo, m, l.taxa);
            return (
              <div key={l.nome} className="sugestao-cartao">
                <span>{l.nome}</span>
                <strong>{p ? moeda(p) : 'Impossível'}</strong>
                {p ? <small>lucro de {moeda(p - custo - (p * l.taxa) / 100)} por unidade</small> : <small>margem + taxa passam de 100%</small>}
              </div>
            );
          })}
        </div>
      ) : (
        <Vazio>Informe um custo maior que zero e uma margem válida.</Vazio>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Insumos                                                              */
/* ------------------------------------------------------------------ */

function textoCusto(i) {
  const c = custoUnitario(i);
  if (i.unidade_base === 'un') return `${moeda(c)} por unidade`;
  const grande = i.unidade_base === 'g' ? 'kg' : 'L';
  return `${moeda(c * 1000)}/${grande} · R$ ${c.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}/${i.unidade_base}`;
}

function textoEmbalagem(i) {
  const u = unidadeCompra(i.unidade_compra);
  return `${numero(Number(i.quantidade_embalagem) / u.fator, 3)} ${u.id}`;
}

function Insumos({ setMsg }) {
  const { insumos, composicao, produtos, estoquePorId, atualizar } = useDados();
  const [editando, setEditando] = useState(null);
  const usoPorInsumo = useMemo(() => {
    const m = {};
    for (const c of composicao) m[c.insumo_id] = (m[c.insumo_id] || 0) + 1;
    return m;
  }, [composicao]);

  async function excluir(i) {
    if (usoPorInsumo[i.id]) {
      const nomes = produtos.filter((p) => composicao.some((c) => c.produto_id === p.id && c.insumo_id === i.id)).map((p) => p.nome);
      return setMsg({ tipo: 'erro', texto: `"${i.nome}" é usado em: ${nomes.join(', ')}. Remova-o desses produtos antes de excluir.` });
    }
    if (!confirm(`Excluir o insumo "${i.nome}"?`)) return;
    const { error } = await supabase.from('insumos').delete().eq('id', i.id);
    if (error) return setMsg({ tipo: 'erro', texto: mensagemErro(error) });
    await atualizar();
    setMsg({ tipo: 'ok', texto: 'Insumo excluído.' });
  }

  return (
    <div className="painel">
      <div className="painel-topo">
        <h2>Insumos</h2>
        <button type="button" className="btn btn-primario" onClick={() => setEditando({})}>+ Novo insumo</button>
      </div>
      <p className="nota">Cadastre como você compra (ex.: balde de 10 kg por R$ 180). O custo por grama/ml/unidade é calculado sozinho.</p>
      {!insumos.length ? <Vazio>Nenhum insumo cadastrado.</Vazio> : (
        <ul className="lista">
          {insumos.map((i) => (
            <li key={i.id} className="item">
              <div className="item-principal">
                <span className="item-titulo">{i.nome}</span>
                <span className="item-detalhe">
                  <span>{textoEmbalagem(i)} por {moeda(i.valor_pago)}</span>
                  <SeloEstoque insumo={i} estoque={estoquePorId[i.id]?.estoque} />
                  <span className="etiqueta">{usoPorInsumo[i.id] ? `usado em ${usoPorInsumo[i.id]} produto(s)` : 'não usado'}</span>
                </span>
              </div>
              <div className="item-valor item-valor-longo">{textoCusto(i)}</div>
              <div className="item-acoes">
                <button type="button" className="btn-icone" onClick={() => setEditando(i)} aria-label="Editar">✏️</button>
                <button type="button" className="btn-icone" onClick={() => excluir(i)} aria-label="Excluir">🗑️</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal titulo={editando?.id ? 'Editar insumo' : 'Novo insumo'} aberto={!!editando} onFechar={() => setEditando(null)}>
        {editando && (
          <FormInsumo
            insumo={editando}
            usos={usoPorInsumo[editando.id] || 0}
            onSalvo={(texto) => { setEditando(null); setMsg({ tipo: 'ok', texto }); }}
            onCancelar={() => setEditando(null)}
          />
        )}
      </Modal>
    </div>
  );
}

function FormInsumo({ insumo, usos, onSalvo, onCancelar }) {
  const { atualizar } = useDados();
  const novo = !insumo.id;
  const u0 = unidadeCompra(insumo.unidade_compra || 'kg');
  const [nome, setNome] = useState(insumo.nome || '');
  const [valor, setValor] = useState(paraCampo(insumo.valor_pago ?? ''));
  const [qtd, setQtd] = useState(insumo.id ? paraCampo(Number(insumo.quantidade_embalagem) / u0.fator) : '');
  const [unidade, setUnidade] = useState(u0.id);
  const [minimo, setMinimo] = useState(insumo.id && Number(insumo.estoque_minimo) ? paraCampo(Number(insumo.estoque_minimo) / u0.fator) : '');
  const [erros, setErros] = useState({});
  const [erroGeral, setErroGeral] = useState('');
  const [salvando, setSalvando] = useState(false);

  const u = unidadeCompra(unidade);
  const v = lerNumero(valor);
  const q = lerNumero(qtd);
  const mudouBase = !novo && usos > 0 && u.base !== insumo.unidade_base;
  const previa = v >= 0 && q > 0 ? textoCusto({ valor_pago: v, quantidade_embalagem: q * u.fator, unidade_base: u.base }) : null;

  async function salvar(e) {
    e.preventDefault();
    const er = {};
    if (!nome.trim()) er.nome = 'Informe o nome.';
    if (!(v >= 0) || valor === '') er.valor = 'Informe um valor válido (não negativo).';
    if (!(q > 0)) er.qtd = 'A quantidade deve ser maior que zero.';
    if (mudouBase) er.unidade = `Este insumo é usado em produtos medidos em "${insumo.unidade_base}". Escolha uma unidade do mesmo tipo.`;
    const m = minimo === '' ? 0 : lerNumero(minimo);
    if (!(m >= 0)) er.minimo = 'Informe um número (não negativo) ou deixe vazio.';
    setErros(er);
    if (Object.keys(er).length) return;
    const registro = { nome: nome.trim(), valor_pago: v, quantidade_embalagem: q * u.fator, unidade_compra: u.id, unidade_base: u.base, estoque_minimo: m * u.fator };
    setSalvando(true);
    const { error } = novo
      ? await supabase.from('insumos').insert(registro)
      : await supabase.from('insumos').update(registro).eq('id', insumo.id);
    if (error) { setSalvando(false); return setErroGeral(mensagemErro(error)); }
    await atualizar();
    setSalvando(false);
    onSalvo(novo ? 'Insumo cadastrado!' : usos ? `Insumo atualizado! ${usos} produto(s) recalculado(s) com o novo preço.` : 'Insumo atualizado!');
  }

  return (
    <form onSubmit={salvar} noValidate className="form-grade">
      <Aviso tipo="erro">{erroGeral}</Aviso>
      <Campo rotulo="Nome do insumo" erro={erros.nome} largo>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Açaí (balde 10 kg)" />
      </Campo>
      <Campo rotulo="Valor pago pela embalagem" erro={erros.valor}>
        <CampoNumero prefixo="R$" value={valor} onChange={setValor} placeholder="0,00" />
      </Campo>
      <Campo rotulo="Quantidade na embalagem" erro={erros.qtd || erros.unidade}>
        <div className="linha-inline">
          <CampoNumero value={qtd} onChange={setQtd} placeholder="Ex.: 10" />
          <select value={unidade} onChange={(e) => setUnidade(e.target.value)} aria-label="Unidade">
            {UNIDADES_COMPRA.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </div>
      </Campo>
      <Campo rotulo="Estoque mínimo (aviso de reposição)" erro={erros.minimo} dica="Opcional. Quando o estoque ficar abaixo disso, o painel avisa.">
        <CampoNumero sufixo={u.id} value={minimo} onChange={setMinimo} placeholder="Ex.: 5" />
      </Campo>
      <div className="campo-largo previa">
        {previa ? <>Custo calculado: <strong>{previa}</strong></> : 'Preencha valor e quantidade para ver o custo por unidade.'}
        {usos > 0 && <div className="nota">Usado em {usos} produto(s): o custo deles será recalculado automaticamente.</div>}
      </div>
      <div className="form-acoes">
        <button type="button" className="btn btn-fantasma" onClick={onCancelar}>Cancelar</button>
        <button className="btn btn-primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar insumo'}</button>
      </div>
    </form>
  );
}

export function SeloEstoque({ insumo, estoque }) {
  if (estoque === undefined || estoque === null) return null;
  const sit = situacaoEstoque(Number(estoque), Number(insumo.estoque_minimo));
  return (
    <span className={`etiqueta etq-estoque-${sit.id}`}>
      Estoque: {formatarQtd(estoque, insumo.unidade_base)}{sit.id !== 'ok' ? ` · ${sit.nome}` : ''}
    </span>
  );
}
