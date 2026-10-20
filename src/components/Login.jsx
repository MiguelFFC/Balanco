import { useState } from 'react';
import { supabase, mensagemErro } from '../lib/supabase';
import { Aviso } from './ui';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  async function entrar(e) {
    e.preventDefault();
    if (!email.trim() || !senha) return setErro('Preencha e-mail e senha.');
    setEntrando(true);
    setErro('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setEntrando(false);
    if (error) setErro(mensagemErro(error));
  }

  return (
    <div className="tela-centro tela-login">
      <form className="cartao-login" onSubmit={entrar} noValidate>
        <img src="/favicon.svg" alt="" width="56" height="56" />
        <h1>Balanço Açaí</h1>
        <p className="sub">Entre para ver o caixa da sua loja</p>
        <Aviso tipo="erro">{erro}</Aviso>
        <label className="campo campo-largo">
          <span className="campo-rotulo">E-mail</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="campo campo-largo">
          <span className="campo-rotulo">Senha</span>
          <input type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>
        <button className="btn btn-primario btn-bloco" disabled={entrando}>{entrando ? 'Entrando…' : 'Entrar'}</button>
        <p className="dica-login">Os usuários são criados no painel do Supabase (Authentication → Users).</p>
      </form>
    </div>
  );
}
