// Gera um CSV que o Excel em português abre direto:
// separador ";" , vírgula decimal e acentos preservados (BOM UTF-8).
export function baixarCSV(nomeArquivo, colunas, linhas) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const conteudo = [
    colunas.map((c) => esc(c.titulo)).join(';'),
    ...linhas.map((l) => colunas.map((c) => esc(c.valor(l))).join(';')),
  ].join('\r\n');
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
