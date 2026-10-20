import { useEffect, useState } from 'react';
import { supabase, configurado, mensagemErro } from './lib/supabase';
import { DadosProvider, useDados } from './lib/dados';
import Login from './components/Login';
import Lancamentos from './components/Lancamentos';
import Balanco from './components/Balanco';
import Precificacao from './components/Precificacao';
import { Aviso, Carregando } from './components/ui';

const ABAS = [
  { id: 'balanco', nome: 'Balanço', icone: '📊' },
  { id: 'lancamentos', nome: 'Lançamentos', icone: '🧾' },
  { id: 'precificacao', nome: 'Precificação', icone: '🏷️' },
];

export default function App() {
  const [sessao, setSessao] = useState(undefined);

  useEffect(() => {
    if (!configurado) return;
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSessao(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!configurado) {
    return (
      <div className="tela-centro">
        <div className="cartao-login">
          <h1>⚙️ Falta configurar</h1>
          <p>
            Não encontrei a URL e a chave do Supabase. Crie o arquivo <code>.env</code> (copiando o
            <code> .env.example</code>) ou cadastre as variáveis <code>VITE_SUPABASE_URL</code> e
            <code> VITE_SUPABASE_KEY</code> na Vercel. Veja o passo a passo no README.
          </p>
        </div>
      </div>
    );
  }
  if (sessao === undefined) return <div className="tela-centro"><Carregando /></div>;
  if (!sessao) return <Login />;

  return (
    <DadosProvider key={sessao.user.id}>
      <Painel email={sessao.user.email} />
    </DadosProvider>
  );
}

function Painel({ email }) {
  const [aba, setAba] = useState(() => {
    try { return localStorage.getItem('aba') || 'balanco'; } catch { return 'balanco'; }
  });
  const { carregando, erro, config, atualizar } = useDados();
  const [limpando, setLimpando] = useState(false);
  const [msg, setMsg] = useState(null);

  const trocarAba = (id) => {
    setAba(id);
    try { localStorage.setItem('aba', id); } catch { /* sem armazenamento local */ }
    window.scrollTo(0, 0);
  };

  async function limparExemplos() {
    if (!confirm('Apagar todos os dados de exemplo (vendas, compras, insumos e produtos de exemplo)? Os dados que você cadastrou continuam.')) return;
    setLimpando(true);
    const { error } = await supabase.rpc('limpar_dados_exemplo');
    setLimpando(false);
    if (error) return setMsg({ tipo: 'erro', texto: mensagemErro(error) });
    await atualizar();
    setMsg({ tipo: 'ok', texto: 'Dados de exemplo apagados. Agora é só cadastrar os seus!' });
  }

  return (
    <div className="app">
      <header className="topo">
        <div className="marca">
          <img src="/favicon.svg" alt="" width="32" height="32" />
          <span>Balanço Açaí</span>
        </div>
        <nav className="abas" aria-label="Áreas">
          {ABAS.map((a) => (
            <button key={a.id} type="button" className={`aba${aba === a.id ? ' aba-ativa' : ''}`} onClick={() => trocarAba(a.id)}>
              <span aria-hidden="true">{a.icone}</span> {a.nome}
            </button>
          ))}
        </nav>
        <div className="usuario">
          <span className="usuario-email" title={email}>{email}</span>
          <button type="button" className="btn btn-fantasma btn-pq" onClick={() => supabase.auth.signOut()}>Sair</button>
        </div>
      </header>

      <main className="conteudo">
        {config?.exemplo_ativo && (
          <div className="faixa-exemplo">
            <span>Você está vendo <strong>dados de exemplo</strong> para conhecer o painel.</span>
            <button type="button" className="btn btn-perigo btn-pq" onClick={limparExemplos} disabled={limpando}>
              {limpando ? 'Limpando…' : 'Limpar dados de exemplo'}
            </button>
          </div>
        )}
        {msg && <Aviso tipo={msg.tipo} onFechar={() => setMsg(null)}>{msg.texto}</Aviso>}
        {erro && <Aviso tipo="erro">{erro} — confira se você rodou o arquivo supabase/schema.sql no Supabase.</Aviso>}
        {carregando ? (
          <Carregando />
        ) : (
          <>
            {aba === 'balanco' && <Balanco />}
            {aba === 'lancamentos' && <Lancamentos />}
            {aba === 'precificacao' && <Precificacao />}
          </>
        )}
      </main>
    </div>
  );
}
