import { paraISO, hojeISO, deISO, dataBR } from './format';

export const PRESETS = [
  { id: 'hoje', nome: 'Hoje' },
  { id: 'semana', nome: 'Esta semana' },
  { id: 'mes', nome: 'Este mês' },
  { id: 'mes_anterior', nome: 'Mês anterior' },
  { id: 'personalizado', nome: 'Personalizado' },
];

// Retorna { inicio, fim } no formato "aaaa-mm-dd"
export function calcularPeriodo(preset, inicioPers, fimPers) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  switch (preset) {
    case 'hoje':
      return { inicio: paraISO(hoje), fim: paraISO(hoje) };
    case 'semana': {
      // semana de segunda a domingo
      const diaSemana = (hoje.getDay() + 6) % 7;
      const seg = new Date(hoje);
      seg.setDate(hoje.getDate() - diaSemana);
      const dom = new Date(seg);
      dom.setDate(seg.getDate() + 6);
      return { inicio: paraISO(seg), fim: paraISO(dom) };
    }
    case 'mes_anterior': {
      const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
      return { inicio: paraISO(ini), fim: paraISO(fim) };
    }
    case 'personalizado': {
      const ini = inicioPers || hojeISO();
      const fim = fimPers || ini;
      return ini <= fim ? { inicio: ini, fim } : { inicio: fim, fim: ini };
    }
    case 'mes':
    default: {
      const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
      return { inicio: paraISO(ini), fim: paraISO(fim) };
    }
  }
}

export function descreverPeriodo({ inicio, fim }) {
  return inicio === fim ? dataBR(inicio) : `${dataBR(inicio)} a ${dataBR(fim)}`;
}

// Lista de dias entre duas datas ISO (inclusive)
export function diasEntre(inicio, fim) {
  const dias = [];
  const d = deISO(inicio);
  const f = deISO(fim);
  while (d <= f) {
    dias.push(paraISO(d));
    d.setDate(d.getDate() + 1);
  }
  return dias;
}
