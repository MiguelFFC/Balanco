# 🍇 Balanço Açaí — dashboard financeiro da loja

Painel web para controlar **vendas, compras, lucro e precificação** de uma loja de delivery de açaí.
Os dados ficam salvos na nuvem (Supabase), e você acessa pelo computador ou pelo celular.

- **Balanço**: faturamento, gastos, taxas, lucro líquido, margem e gráficos por período.
- **Lançamentos**: registro de vendas e compras, com busca, filtro por período, edição, exclusão e exportação em CSV (Excel).
- **Precificação**: insumos, ficha técnica dos produtos, custo automático, lucro com/sem taxa do iFood e cartão, e calculadora de preço sugerido.

---

## Sumário do passo a passo

1. [Criar o projeto no Supabase](#1-criar-o-projeto-no-supabase)
2. [Criar as tabelas (rodar o SQL)](#2-criar-as-tabelas-rodar-o-sql)
3. [Criar seu usuário e bloquear cadastros de estranhos](#3-criar-seu-usuário-de-login)
4. [Pegar a URL e a chave do Supabase](#4-pegar-a-url-e-a-chave)
5. [Rodar no seu computador](#5-rodar-no-seu-computador)
6. [Publicar na Vercel (ter um link)](#6-publicar-na-vercel)
7. [Como usar cada aba](#7-como-usar-cada-aba)
8. [Dúvidas comuns](#8-dúvidas-comuns)

---

## 1. Criar o projeto no Supabase

1. Acesse **https://supabase.com** e clique em **Start your project**. Entre com sua conta do GitHub ou e-mail.
2. Clique em **New project**.
3. Preencha:
   - **Name**: `balanco-acai` (ou o nome que quiser)
   - **Database Password**: clique em *Generate a password* e **guarde essa senha** num lugar seguro (você quase nunca vai precisar dela, mas é bom ter).
   - **Region**: escolha **South America (São Paulo)** — fica mais rápido no Brasil.
   - **Plan**: *Free* (gratuito).
4. Clique em **Create new project** e espere 1 a 2 minutos até o projeto ficar pronto.

## 2. Criar as tabelas (rodar o SQL)

1. No menu da esquerda do Supabase, clique em **SQL Editor**.
2. Clique em **+ New query** (nova consulta).
3. Abra o arquivo [`supabase/schema.sql`](supabase/schema.sql) deste projeto, **copie todo o conteúdo** e cole no editor.
4. Clique em **Run** (ou Ctrl+Enter). Deve aparecer *"Success. No rows returned"*.
   - Se aparecer um aviso pedindo confirmação sobre "operações destrutivas", pode confirmar: o script **não apaga** dados, apenas recria as regras de segurança.

Pronto! Isso criou as tabelas `categorias`, `compras`, `vendas`, `insumos`, `produtos`, `produto_insumos` (composição) e `configuracoes`, já com **Row Level Security (RLS)** ligado: cada usuário logado só vê e altera os próprios dados, e quem não está logado não vê nada.

> Os **dados de exemplo** são criados automaticamente na primeira vez que você entrar no painel. Para apagá-los há o botão **"Limpar dados de exemplo"** no topo.

## 3. Criar seu usuário de login

O painel não tem tela de "criar conta" — por segurança, você cria os usuários direto no Supabase.

1. No menu da esquerda, clique em **Authentication** → **Users**.
2. Clique em **Add user** → **Create new user**.
3. Digite seu **e-mail** e uma **senha**, e deixe marcada a opção **Auto Confirm User**.
4. Clique em **Create user**.

**Muito importante — desligue cadastros públicos:**

1. Ainda em **Authentication**, abra **Sign In / Providers** (em algumas versões: *Providers* ou *Settings*).
2. Desligue a opção **Allow new users to sign up** e clique em **Save**.

Assim ninguém consegue criar conta sozinho no seu projeto.

> 💡 Cada usuário tem os **seus próprios dados**. Se um funcionário for lançar vendas na mesma loja, use **o mesmo login** (e-mail/senha) para todos verem os mesmos números.
> Esqueceu a senha? Em *Authentication → Users*, clique nos **três pontinhos** ao lado do usuário e envie um link de recuperação, ou apague e crie o usuário de novo (os dados ficam ligados ao usuário, então prefira o link de recuperação).

## 4. Pegar a URL e a chave

O painel precisa de duas informações do Supabase. Elas ficam em **variáveis de ambiente** (arquivo `.env`), nunca escritas no código.

1. No topo do painel do seu projeto no Supabase, clique no botão **Connect** (ou vá em **Project Settings**, a engrenagem ⚙️ no menu da esquerda).
2. **URL do projeto**: em *Project Settings → Data API* (ou na janela *Connect*), copie o **Project URL**. Ela tem este formato: `https://abcdefghijk.supabase.co`
3. **Chave pública**: em *Project Settings → API Keys*, copie a **Publishable key** (começa com `sb_publishable_...`).
   - Se o seu painel mostrar as chaves antigas (aba *Legacy API Keys*), copie a chave **`anon` `public`** — funciona igual.

> ⚠️ **Nunca** use a chave **`secret`** nem a **`service_role`**. Elas dão acesso total ao banco e não podem ir para o site.
> A chave *publishable/anon* foi feita para ficar no navegador — quem protege seus dados é o login + RLS que o SQL ativou.

## 5. Rodar no seu computador

Você só precisa fazer isso uma vez para testar (depois pode usar direto pelo link da Vercel).

### 5.1 Instalar o Node.js
1. Acesse **https://nodejs.org** e baixe a versão **LTS**.
2. Instale clicando em "Avançar" até o fim.

### 5.2 Baixar este projeto
- Pelo GitHub: na página do repositório, clique no botão verde **Code** → **Download ZIP** e descompacte numa pasta (ex.: `Documentos/balanco-acai`).
- (Ou, se você usa Git: `git clone` do repositório.)

### 5.3 Criar o arquivo `.env`
1. Dentro da pasta do projeto, faça uma **cópia** do arquivo `.env.example` e renomeie a cópia para **`.env`** (exatamente assim, com o ponto na frente e sem `.txt` no final).
   - No Windows, se não aparecer a extensão, ative em *Explorador de Arquivos → Exibir → Extensões de nomes de arquivos*.
2. Abra o `.env` no Bloco de Notas e cole seus dados do passo 4:
   ```
   VITE_SUPABASE_URL=https://abcdefghijk.supabase.co
   VITE_SUPABASE_KEY=sb_publishable_xxxxxxxxxxxxxxxx
   ```
3. Salve. O arquivo `.env` **não vai para o GitHub** (está no `.gitignore`), então suas chaves ficam só no seu computador.

### 5.4 Abrir o terminal na pasta e rodar
- **Windows**: abra a pasta do projeto, clique na barra de endereço, digite `cmd` e aperte Enter.
- **Mac**: clique com o botão direito na pasta → *Novo Terminal na Pasta*.

Digite os comandos abaixo (um de cada vez, apertando Enter):

```bash
npm install
npm run dev
```

O primeiro baixa as dependências (só precisa uma vez, demora 1–2 min). O segundo liga o painel e mostra um endereço como **http://localhost:5173** — abra esse endereço no navegador e faça login com o usuário do passo 3.

Para desligar, volte ao terminal e aperte **Ctrl + C**.

## 6. Publicar na Vercel

Assim você terá um link (ex.: `https://balanco-acai.vercel.app`) para abrir no celular e no computador de qualquer lugar.

1. Garanta que o código está no seu GitHub (este repositório).
2. Acesse **https://vercel.com** e clique em **Sign Up** → **Continue with GitHub** (plano *Hobby*, gratuito).
3. No painel da Vercel, clique em **Add New… → Project**.
4. Na lista de repositórios, encontre **balanco** e clique em **Import**. (Se ele não aparecer, clique em *Adjust GitHub App Permissions* e libere o acesso ao repositório.)
5. A Vercel detecta sozinha que é um projeto **Vite**. Não mexa em *Build Command* nem *Output Directory*.
6. Abra a seção **Environment Variables** e adicione as duas variáveis (as mesmas do `.env`):

   | Key (nome) | Value (valor) |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://abcdefghijk.supabase.co` |
   | `VITE_SUPABASE_KEY` | `sb_publishable_xxxxxxxx` |

7. Clique em **Deploy** e espere ~1 minuto. Aparece uma tela de parabéns com o **link do seu painel**. 🎉
8. **No celular**: abra o link no navegador e use *"Adicionar à tela inicial"* (Android: menu ⋮; iPhone: botão Compartilhar) para ter um ícone igual a um app.

> Sempre que um novo código for enviado ao GitHub (branch principal), a Vercel publica a nova versão sozinha.
> Se você mudar as variáveis depois, vá em *Project → Settings → Environment Variables*, altere e depois em *Deployments* clique nos **três pontinhos → Redeploy**.

## 7. Como usar cada aba

### 📊 Balanço (painel principal)
- Escolha o período: **Hoje, Esta semana, Este mês, Mês anterior** ou **Personalizado** (escolha as datas "de" e "até").
- **Cartões**:
  - *Faturamento* = soma do valor recebido nas vendas
  - *Total de gastos* = soma das compras
  - *Taxas pagas* = taxas de iFood/cartão das vendas
  - *Lucro líquido* = faturamento − gastos − taxas
  - *Margem de lucro* = lucro líquido ÷ faturamento
- **Gráficos**: entradas x saídas por dia (ou por mês em períodos longos), gastos por categoria, vendas por canal e produtos mais vendidos. Passe o mouse (ou toque) nas barras para ver os valores.

### 🧾 Lançamentos
- Alterne entre **Vendas** e **Compras (gastos)** no botão do topo.
- **+ Nova venda**: escolha um produto cadastrado e o **valor é preenchido sozinho** (preço × quantidade — dá para ajustar se deu desconto). Ao escolher **iFood** ou pagamento com **cartão**, a taxa em % é sugerida automaticamente (configure as % na aba Precificação). Você pode trocar a taxa para **R$** (valor fixo) ou **%**.
- **+ Nova compra**: data, item, fornecedor, categoria, quantidade, unidade, valor total, forma de pagamento e observação. Para uma categoria nova, clique em **+ Nova** ao lado da lista.
- Use a **busca** e o **filtro de período** para achar lançamentos. ✏️ edita, 🗑️ exclui.
- **⬇ Exportar CSV** baixa a lista que está na tela (já filtrada) num arquivo que o **Excel** abre direto, com acentos e vírgula decimal certinhos.
- O sistema não deixa salvar valores negativos, quantidades zeradas ou campos obrigatórios vazios. Valores podem ser digitados com vírgula (ex.: `18,50`).

### 🏷️ Precificação
1. **Taxas que você paga**: informe a % do iFood e da maquininha de cartão e clique em *Salvar taxas*.
2. **Insumos**: cadastre do jeito que você compra. Exemplos:
   - "Açaí (balde 10 kg)" → valor `180`, quantidade `10`, unidade `kg` → custo calculado: **R$ 18,00/kg · R$ 0,018/g**
   - "Copo 300ml (pct 100)" → valor `35`, quantidade `100`, unidade `unidade` → **R$ 0,35 por unidade**
3. **Produtos**: clique em **+ Novo produto**, dê um nome (ex.: *Açaí 500ml*), o preço de venda e adicione os insumos com a quantidade usada em **uma unidade** do produto (em g, ml ou un — a unidade aparece ao lado do campo). Ex.: açaí 420 g, copo 1 un, tampa 1 un, colher 1 un, leite em pó 20 g…
   - O cartão de cada produto mostra **custo, lucro em R$, margem %, lucro no iFood e lucro no cartão** (já descontando a taxa).
   - Dentro do formulário há o atalho **"Quero margem de X%"** → mostra o preço sugerido e o botão *Usar*.
4. **Atualizou o preço de um insumo?** Basta editar o insumo: **todos os produtos que usam ele são recalculados na hora** (o custo é sempre calculado com o preço atual).
5. **Calculadora de preço sugerido**: escolha um produto (ou digite um custo), informe a margem desejada e veja o preço ideal para venda **sem taxa**, **no cartão** e **no iFood**.

### 🧹 Dados de exemplo
Na primeira vez que você entra, o painel cria categorias padrão (Insumos, Embalagens, Limpeza, Aluguel/Contas, Entregas, Marketing, Outros) e alguns dados de exemplo (vendas, compras, insumos e 3 produtos). Quando quiser começar de verdade, clique em **Limpar dados de exemplo** no topo. As categorias e qualquer coisa que **você** cadastrou continuam lá.

## 8. Dúvidas comuns

- **"Falta configurar" ao abrir o painel** → o `.env` (no computador) ou as *Environment Variables* (na Vercel) não foram preenchidos. Na Vercel, depois de adicionar, faça *Redeploy*.
- **"E-mail ou senha incorretos"** → confira o usuário em *Authentication → Users* no Supabase.
- **Erro falando de tabela ou "relation does not exist"** → o SQL do passo 2 não foi rodado (ou foi rodado em outro projeto).
- **O projeto gratuito "dormiu"** → no plano Free, o Supabase **pausa projetos sem uso por 7 dias**. Se acontecer, entre em supabase.com, abra o projeto e clique em **Restore project**. Usando o painel toda semana, isso não acontece.
- **Backup**: exporte o CSV de vendas e compras de vez em quando e guarde no seu Drive.

---

### Para quem for mexer no código
- Tecnologias: React + Vite, Supabase (`@supabase/supabase-js`), Recharts.
- Estrutura: `src/components` (telas), `src/lib` (cálculos, formatação, CSV, acesso a dados), `supabase/schema.sql` (banco, RLS e funções de dados de exemplo).
- Comandos: `npm run dev` (desenvolvimento), `npm run build` (gera a pasta `dist`).
