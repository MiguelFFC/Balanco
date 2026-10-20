import { useCallback, useEffect, useState } from 'react';
import { supabase, buscarTodos, mensagemErro } from './supabase';

// Carrega compras ou vendas de um período
export function useLancamentos(tabela, inicio, fim, versao) {
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    const colunas = tabela === 'compras' ? '*, categorias(nome)' : '*';
    buscarTodos(() =>
      supabase
        .from(tabela)
        .select(colunas)
        .gte('data', inicio)
        .lte('data', fim)
        .order('data', { ascending: false })
        .order('id', { ascending: false })
    )
      .then((d) => ativo && (setLinhas(d), setErro('')))
      .catch((e) => ativo && setErro(mensagemErro(e)))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [tabela, inicio, fim, versao, recarga]);

  const recarregar = useCallback(() => setRecarga((r) => r + 1), []);
  return { linhas, carregando, erro, recarregar };
}
