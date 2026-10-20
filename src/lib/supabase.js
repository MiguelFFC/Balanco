import { createClient } from '@supabase/supabase-js';

// Os valores vêm do arquivo .env (no computador) ou das
// "Environment Variables" da Vercel (no site publicado).
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

export const configurado = Boolean(url && key);

export const supabase = configurado ? createClient(url, key) : null;

// Busca todas as linhas, de 1000 em 1000 (limite padrão do Supabase por consulta).
export async function buscarTodos(montarConsulta) {
  const tamanho = 1000;
  let inicio = 0;
  let todas = [];
  for (;;) {
    const { data, error } = await montarConsulta().range(inicio, inicio + tamanho - 1);
    if (error) throw error;
    todas = todas.concat(data);
    if (data.length < tamanho) return todas;
    inicio += tamanho;
  }
}

// Traduz as mensagens de erro mais comuns.
export function mensagemErro(error) {
  const msg = error?.message || String(error);
  if (/Invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(msg)) return 'E-mail ainda não confirmado. Confirme pelo link enviado ou marque "Auto Confirm" ao criar o usuário no Supabase.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Sem conexão com o servidor. Verifique sua internet.';
  if (/violates foreign key constraint.*insumo/i.test(msg)) return 'Este insumo é usado em algum produto. Remova-o dos produtos antes de excluir.';
  if (/duplicate key/i.test(msg)) return 'Já existe um registro com esse nome.';
  if (/violates check constraint/i.test(msg)) return 'Algum valor está inválido (negativo ou vazio).';
  return msg;
}
