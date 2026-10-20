import { useEffect, useState } from 'react';
import { PRESETS, calcularPeriodo, descreverPeriodo } from '../lib/periodo';
import { hojeISO } from '../lib/format';

export function Modal({ titulo, aberto, onFechar, children }) {
  useEffect(() => {
    if (!aberto) return;
    const esc = (e) => e.key === 'Escape' && onFechar();
    document.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = '';
    };
  }, [aberto, onFechar]);
  if (!aberto) return null;
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-topo">
          <h2>{titulo}</h2>
          <button type="button" className="btn-icone" onClick={onFechar} aria-label="Fechar">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Campo({ rotulo, erro, children, largo, dica }) {
  return (
    <label className={`campo${largo ? ' campo-largo' : ''}${erro ? ' campo-erro' : ''}`}>
      <span className="campo-rotulo">{rotulo}</span>
      {children}
      {dica && !erro && <span className="campo-dica">{dica}</span>}
      {erro && <span className="campo-msg-erro">{erro}</span>}
    </label>
  );
}

// Campo de texto que aceita vírgula ("18,50")
export function CampoNumero({ value, onChange, prefixo, sufixo, ...resto }) {
  return (
    <div className="campo-num">
      {prefixo && <span className="campo-num-aff">{prefixo}</span>}
      <input type="text" inputMode="decimal" autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} {...resto} />
      {sufixo && <span className="campo-num-aff">{sufixo}</span>}
    </div>
  );
}

export function Aviso({ tipo = 'info', children, onFechar }) {
  if (!children) return null;
  return (
    <div className={`aviso aviso-${tipo}`} role={tipo === 'erro' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onFechar && <button type="button" className="btn-icone" onClick={onFechar} aria-label="Fechar aviso">✕</button>}
    </div>
  );
}

export function usePeriodo(presetInicial = 'mes') {
  const [preset, setPreset] = useState(presetInicial);
  const [inicioPers, setInicioPers] = useState(hojeISO());
  const [fimPers, setFimPers] = useState(hojeISO());
  const periodo = calcularPeriodo(preset, inicioPers, fimPers);
  return { preset, setPreset, inicioPers, setInicioPers, fimPers, setFimPers, ...periodo };
}

export function FiltroPeriodo({ p }) {
  return (
    <div className="filtro-periodo">
      <div className="chips" role="group" aria-label="Período">
        {PRESETS.map((x) => (
          <button key={x.id} type="button" className={`chip${p.preset === x.id ? ' chip-ativo' : ''}`} onClick={() => p.setPreset(x.id)}>
            {x.nome}
          </button>
        ))}
      </div>
      {p.preset === 'personalizado' ? (
        <div className="datas-pers">
          <label>De <input type="date" value={p.inicioPers} onChange={(e) => p.setInicioPers(e.target.value)} /></label>
          <label>até <input type="date" value={p.fimPers} onChange={(e) => p.setFimPers(e.target.value)} /></label>
        </div>
      ) : (
        <span className="periodo-desc">{descreverPeriodo(p)}</span>
      )}
    </div>
  );
}

export function Vazio({ children }) {
  return <div className="vazio">{children}</div>;
}

export function Carregando() {
  return <div className="carregando" aria-live="polite"><span className="spinner" /> Carregando…</div>;
}
