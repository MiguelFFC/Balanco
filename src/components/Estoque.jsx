import { useMemo, useState } from 'react';
import { supabase, mensagemErro } from '../lib/supabase';
import { useDados } from '../lib/dados';
import { moeda, hojeISO, lerNumero, normalizar } from '../lib/format';
import { custoUnitario, formatarQtd, situacaoEstoque, unidadesDaBase, unidadeCompra } from '../lib/calculos';
import { Aviso, Campo, CampoNumero, Modal, Vazio } from './ui';

const ORDEM = { zerado: 0, baixo: 1, ok: 2 };

export default function Estoque() {
  const { insumos, estoquePorId } = useDados();
  const [busca, setBusca] = useState('');
  const [ajustando, setAjustando] = useState(null);
  const [aberto, setAberto] = useState(null);
  const [msg, setMsg] = useState(null);

  const linhas = useMemo(() => {
    const termo = normalizar(busca.trim());
    return insumos
      .filter((i) => !termo || normalizar(i.nome).includes(termo))
      .map((i) => {
        const e = estoquePorId[i.id] || { estoque: 0, entradas: 0, saidas: 0, ajustes: 0 };
        const estoque = Number(e.estoque);
        return { i, e, estoque, sit: situacaoEstoque(estoque, Number(i.estoque_minimo)) };
      })
      .sort((a, b) => ORDEM[a.sit.id] - ORDEM[b.sit.id] || a.i.nome.localeCompare(b.i.nome, 'pt-BR'));
  }, [insumos, estoquePorId, busca]);

  const alertas = linhas.filter((l) => l.sit.id !== 'ok').length;
  const valorTotal = linhas.reduce((s, l) => s + Math.max(0, l.estoque) * custoUnitario(l.i), 0);

  return (
    <section>
      <div className="titulo-secao"><h1>Estoque</h1></div>
      <p className="nota">
        O estoque sobe quando você lança uma <strong>compra de insumo</strong> e desce sozinho a cada <strong>venda</strong>,
        de acordo com a ficha técnica do produto (itens fixos + acompanhamentos escolhidos).
        Use <strong>Ajustar</strong> para acertar depois de contar, ou para registrar perdas.
      </p>
      {msg && <Aviso tipo={msg.tipo} onFechar={() => setMsg(null)}>{msg.texto}</Aviso>}
      <div className="resumo-lista">
        <span><strong>{linhas.length}</strong> insumos</span>
        <span>Valor em estoque <strong>{moeda(valorTotal)}</strong></span>
        {alertas > 0 && <span className="texto-alerta">⚠ <strong>{alertas}</strong> precisando repor</span>}
      </div>
      <div className="barra-linha" style={{ marginBottom: 12 }}>
        <input type="search" className="busca" placeholder="Buscar insumo…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar insumo" />
      </div>
      {!insumos.length ? (
        <Vazio>Nenhum insumo cadastrado. Cadastre na aba <strong>Precificação</strong> ou lance uma compra de insumo.</Vazio>
      ) : (
        <ul className="lista">
          {linhas.map(({ i, e, estoque, sit }) => (
            <li key={i.id} className={`item item-estoque estoque-${sit.id}`}>
              <div className="item-principal">
                <span className="item-titulo">{i.nome}</span>
                <span className="item-detalhe">
                  <span className={`etiqueta etq-estoque-${sit.id}`}>{sit.nome}</span>
                  {Number(i.estoque_minimo) > 0 && <span>mínimo {formatarQtd(i.estoque_minimo, i.unidade_base)}</span>}
                  <button type="button" className="link link-pq" onClick={() => setAberto(aberto === i.id ? null : i.id)}>
                    {aberto === i.id ? 'esconder detalhes' : 'detalhes'}
                  </button>
                </span>
                {aberto === i.id && (
                  <span className="item-detalhe">
                    <span>Comprado: +{formatarQtd(e.entradas, i.unidade_base)}</span>
                    <span>Usado nas vendas: −{formatarQtd(e.saidas, i.unidade_base)}</span>
                    <span>Ajustes: {Number(e.ajustes) >= 0 ? '+' : ''}{formatarQtd(e.ajustes, i.unidade_base)}</span>
                  </span>
                )}
              </div>
              <div className="item-valor">{formatarQtd(estoque, i.unidade_base)}</div>
              <div className="item-acoes">
                <button type="button" className="btn btn-fantasma btn-pq" onClick={() => setAjustando({ insumo: i, estoque })}>Ajustar</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Modal titulo={ajustando ? `Ajustar estoque — ${ajustando.insumo.nome}` : ''} aberto={!!ajustando} onFechar={() => setAjustando(null)}>
        {ajustando && (
          <FormAjuste
            {...ajustando}
            onSalvo={(texto) => { setAjustando(null); setMsg({ tipo: 'ok', texto }); }}
            onCancelar={() => setAjustando(null)}
          />
        )}
      </Modal>
    </section>
  );
}

function FormAjuste({ insumo, estoque, onSalvo, onCancelar }) {
  const { atualizar } = useDados();
  const unidades = unidadesDaBase(insumo.unidade_base);
  const [modo, setModo] = useState('contagem');
  const [valor, setValor] = useState('');
  const [unidade, setUnidade] = useState(() => (unidades.some((u) => u.id === insumo.unidade_compra) ? insumo.unidade_compra : unidades[0].id));
  const [motivo, setMotivo] = useState('');
  const [data, setData] = useState(hojeISO());
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const fator = unidadeCompra(unidade).fator;
  const n = lerNumero(valor);
  const base = n * fator;
  const diferenca = modo === 'contagem' ? base - estoque : modo === 'perda' ? -base : base;
  const valido = modo === 'contagem' ? n >= 0 : n > 0;

  async function salvar(e) {
    e.preventDefault();
    if (!data) return setErro('Informe a data.');
    if (!valido) return setErro(modo === 'contagem' ? 'Informe quanto você tem (pode ser 0).' : 'Informe uma quantidade maior que zero.');
    if (Math.abs(diferenca) < 0.0005) return setErro('O estoque já está com esse valor — nada a ajustar.');
    const textoMotivo = motivo.trim() || { contagem: 'Contagem de estoque', perda: 'Perda/descarte', entrada: 'Entrada sem compra' }[modo];
    setSalvando(true);
    const { error } = await supabase.from('estoque_ajustes').insert({
      insumo_id: insumo.id, data, quantidade: Math.round(diferenca * 1000) / 1000, motivo: textoMotivo,
    });
    if (error) { setSalvando(false); return setErro(mensagemErro(error)); }
    await atualizar();
    setSalvando(false);
    onSalvo(`Estoque de ${insumo.nome} ajustado (${diferenca >= 0 ? '+' : ''}${formatarQtd(diferenca, insumo.unidade_base)}).`);
  }

  return (
    <form onSubmit={salvar} noValidate className="form-grade">
      <Aviso tipo="erro">{erro}</Aviso>
      <div className="campo-largo">
        <span className="campo-rotulo">Estoque atual no sistema: <strong>{formatarQtd(estoque, insumo.unidade_base)}</strong></span>
        <div className="segmentado">
          <button type="button" className={modo === 'contagem' ? 'ativo' : ''} onClick={() => setModo('contagem')}>Contei</button>
          <button type="button" className={modo === 'perda' ? 'ativo' : ''} onClick={() => setModo('perda')}>Perda</button>
          <button type="button" className={modo === 'entrada' ? 'ativo' : ''} onClick={() => setModo('entrada')}>Entrada</button>
        </div>
      </div>
      <Campo
        rotulo={{ contagem: 'Quanto você tem de verdade?', perda: 'Quanto perdeu/jogou fora?', entrada: 'Quanto entrou (sem compra)?' }[modo]}
        dica={valido ? `Ajuste: ${diferenca >= 0 ? '+' : ''}${formatarQtd(diferenca, insumo.unidade_base)}` : undefined}
      >
        <div className="linha-inline">
          <CampoNumero value={valor} onChange={setValor} placeholder="0" />
          <select value={unidade} onChange={(e) => setUnidade(e.target.value)} aria-label="Unidade">
            {unidades.map((u) => <option key={u.id} value={u.id}>{u.id}</option>)}
          </select>
        </div>
      </Campo>
      <Campo rotulo="Data">
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </Campo>
      <Campo rotulo="Motivo (opcional)" largo>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: contagem de segunda, pote caiu, estoque inicial…" />
      </Campo>
      <div className="form-acoes">
        <button type="button" className="btn btn-fantasma" onClick={onCancelar}>Cancelar</button>
        <button className="btn btn-primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar ajuste'}</button>
      </div>
    </form>
  );
}
