import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, buscarTodos, mensagemErro } from './supabase';

const Ctx = createContext(null);
export const useDados = () => useContext(Ctx);

// Carrega os cadastros (categorias, insumos, produtos, composição e configurações)
// e oferece "atualizar()" para recarregar tudo depois de uma alteração.
export function DadosProvider({ children }) {
  const [estado, setEstado] = useState({
    categorias: [], insumos: [], produtos: [], composicao: [], estoque: [], config: null,
  });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [versao, setVersao] = useState(0);

  const carregar = useCallback(async () => {
    try {
      // Primeiro acesso: cria categorias padrão e dados de exemplo
      const { data: cfg, error: e1 } = await supabase.from('configuracoes').select('*').maybeSingle();
      if (e1) throw e1;
      if (!cfg) {
        const { error } = await supabase.rpc('carregar_dados_exemplo');
        if (error) throw error;
      }
      const tudo = (t, ordem) => buscarTodos(() => supabase.from(t).select('*').order(ordem));
      const [categorias, insumos, produtos, composicao, estoque, config] = await Promise.all([
        tudo('categorias', 'nome'),
        tudo('insumos', 'nome'),
        tudo('produtos', 'nome'),
        tudo('produto_insumos', 'id'),
        tudo('estoque_insumos', 'insumo_id'),
        supabase.from('configuracoes').select('*').maybeSingle().then(({ data, error }) => {
          if (error) throw error;
          return data;
        }),
      ]);
      setEstado({ categorias, insumos, produtos, composicao, estoque, config });
      setErro('');
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const atualizar = useCallback(async () => {
    await carregar();
    setVersao((v) => v + 1);
  }, [carregar]);

  const valor = useMemo(() => {
    const insumosPorId = Object.fromEntries(estado.insumos.map((i) => [i.id, i]));
    const estoquePorId = Object.fromEntries(estado.estoque.map((e) => [e.insumo_id, e]));
    return { ...estado, insumosPorId, estoquePorId, carregando, erro, versao, atualizar };
  }, [estado, carregando, erro, versao, atualizar]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
