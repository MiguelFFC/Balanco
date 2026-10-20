# 🍇 Balanço Açaí — dashboard financeiro da loja

Painel web para controlar **vendas, compras, lucro e precificação** de uma loja de delivery de açaí.
Os dados ficam salvos na nuvem (Supabase), e você acessa pelo computador ou pelo celular.

- **Balanço**: faturamento, gastos, taxas, lucro líquido, margem e gráficos por período.
- **Lançamentos**: registro de vendas e compras, com busca, filtro por período, edição, exclusão e exportação em CSV (Excel).
- **Precificação**: insumos, ficha técnica dos produtos (itens fixos + acompanhamentos), custo automático, lucro com/sem taxa do iFood e cartão, e calculadora de preço sugerido.
- **Estoque**: saldo de cada insumo, que sobe com as compras e desce sozinho a cada venda, com aviso de reposição.

---

## Sumário do passo a passo

1. [Criar o projeto no Supabase](#1-criar-o-projeto-no-supabase)
2. [Criar as tabelas (rodar o SQL)](#2-criar-as-tabelas-rodar-o-sql)
3. [Criar seu usuário e bloquear cadastros de estranhos](#3-criar-seu-usuário-de-login)
4. [Pegar a URL e a chave do Supabase](#4-pegar-a-url-e-a-chave)
5. [Rodar no seu computador](#5-rodar-no-seu-computador)
6. [Publicar na Hostinger (ter um link)](#6-publicar-na-hostinger)
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
5. Abra outra **New query**, cole o arquivo [`supabase/02_estoque_acompanhamentos.sql`](supabase/02_estoque_acompanhamentos.sql) e clique em **Run** de novo. Ele adiciona acompanhamentos nos pedidos e o controle de estoque.
   - Se aparecer um aviso pedindo confirmação sobre "operações destrutivas", pode confirmar: o script **não apaga** dados, apenas recria as regras de segurança.

Pronto! Isso criou as tabelas `categorias`, `compras`, `vendas`, `insumos`, `produtos`, `produto_insumos` (composição), `configuracoes`, `estoque_ajustes` e `venda_insumos` (consumo de cada venda), já com **Row Level Security (RLS)** ligado: cada usuário logado só vê e altera os próprios dados, e quem não está logado não vê nada.

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

Você só precisa fazer isso uma vez para testar (depois pode usar direto pelo seu link na Hostinger).

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

## 6. Publicar na Hostinger

O painel é um site "estático" (só arquivos HTML, CSS e JavaScript), então funciona em **qualquer plano de hospedagem da Hostinger**, inclusive o mais simples. Você vai gerar os arquivos no seu computador e enviá-los pelo Gerenciador de Arquivos.

> Por que gerar no computador? A URL e a chave do Supabase (do `.env`) são gravadas dentro dos arquivos do site no momento em que ele é gerado. Por isso, faça o passo 5 (com o `.env` preenchido) antes.

### 6.1 Gerar o pacote do site
No terminal, dentro da pasta do projeto, rode:

```bash
npm run hostinger
```

Isso cria o arquivo **`site-hostinger.zip`** na pasta do projeto, já pronto para enviar. (Ele contém o `index.html`, o ícone e a pasta `assets`.)

### 6.2 Escolher onde o painel vai ficar
Escolha **uma** das opções:

- **Subdomínio (recomendado)** — ex.: `painel.seudominio.com.br`. Assim o site da loja (se você tiver um) continua intacto.
  1. No **hPanel** da Hostinger, vá em **Sites** → **Gerenciar** (no seu site/domínio).
  2. No menu da esquerda, abra **Domínios → Subdomínios**.
  3. Digite `painel` e clique em **Criar**. Anote a pasta que ele mostra (geralmente `public_html/painel`).
- **Domínio inteiro** — se o domínio for só para o painel, use a própria pasta `public_html`.
- **Subpasta** — ex.: `seudominio.com.br/painel`: crie uma pasta `painel` dentro de `public_html`.

### 6.3 Enviar os arquivos
1. No hPanel, em **Sites → Gerenciar**, abra **Arquivos → Gerenciador de Arquivos**.
2. Entre na pasta escolhida no passo 6.2 (ex.: `public_html/painel` ou `public_html`).
   - Se for a `public_html` e tiver um arquivo `default.php` (página padrão da Hostinger), apague-o.
3. Clique no ícone de **Upload** (seta para cima) e envie o **`site-hostinger.zip`**.
4. Clique com o botão direito no zip → **Extrair** (Extract) → confirme a pasta atual (deixe o campo de destino como `.` ou em branco).
5. Confira: o `index.html` e a pasta `assets` devem estar **direto** nessa pasta (não dentro de outra subpasta). Depois pode apagar o `.zip`.

### 6.4 Ativar o HTTPS (cadeado)
1. No hPanel, abra **Segurança → SSL** e verifique se o domínio/subdomínio está com SSL **Ativo** (a Hostinger dá o SSL grátis; se não estiver, clique em **Instalar SSL**).
2. Pode levar alguns minutos para um subdomínio novo funcionar.

### 6.5 Abrir
Acesse `https://painel.seudominio.com.br` (ou o endereço que você escolheu) e faça login. 🎉

**No celular**: abra o link no navegador e use *"Adicionar à tela inicial"* (Android: menu ⋮; iPhone: botão Compartilhar) para ter um ícone igual a um app.

### Atualizar o site no futuro
Sempre que o código mudar (ou se você trocar a URL/chave no `.env`): baixe a versão nova, rode `npm run hostinger` de novo, e no Gerenciador de Arquivos **apague a pasta `assets` antiga e o `index.html`**, envie o novo zip e extraia. Os seus **dados não são afetados**: eles ficam no Supabase, não na Hostinger.

## 7. Como usar cada aba

### 📊 Balanço (painel principal)
- Escolha o período: **Hoje, Esta semana, Este mês, Mês anterior** ou **Personalizado** (escolha as datas "de" e "até").
- **Cartões**:
  - *Faturamento* = soma do valor recebido nas vendas
  - *Total de gastos* = soma das compras
  - *Taxas pagas* = taxas de iFood/cartão das vendas
  - *Lucro líquido* = faturamento − gastos − taxas
  - *Margem de lucro* = lucro líquido ÷ faturamento
- **Gráficos**: entradas x saídas por dia (ou por mês em períodos longos), gastos por categoria, vendas por canal, produtos mais vendidos e **acompanhamentos mais pedidos**. Passe o mouse (ou toque) nas barras para ver os valores.

### 🧾 Lançamentos
- Alterne entre **Vendas** e **Compras (gastos)** no botão do topo.
- **+ Nova venda**: escolha um produto cadastrado e toque nos **acompanhamentos** que o cliente pediu (aparece "2 de 3 inclusos"; se passar do incluso, o painel lembra de cobrar o extra). O **valor é preenchido sozinho** (preço × quantidade — dá para ajustar se deu desconto). Ao escolher **iFood** ou pagamento com **cartão**, a taxa em % é sugerida automaticamente (configure as % na aba Precificação). Você pode trocar a taxa para **R$** (valor fixo) ou **%**.
- **+ Nova compra**: escolha o tipo:
  - **📦 Insumo (vai pro estoque)**: escolha o insumo (ou **+ Novo insumo…** para cadastrar na hora), a quantidade e a unidade (ex.: 100 un de "Copo 500ml", 2 kg de "Leite em pó") e o valor. A quantidade **entra no estoque**. Deixe marcado *"Atualizar o preço do insumo"* para que o custo dos produtos acompanhe o último preço pago.
  - **Outra despesa**: aluguel, luz, motoboy, gás… (texto livre, não mexe no estoque).
  - Para uma categoria nova, clique em **+ Nova** ao lado da lista.
- Use a **busca** e o **filtro de período** para achar lançamentos. ✏️ edita, 🗑️ exclui.
- **⬇ Exportar CSV** baixa a lista que está na tela (já filtrada) num arquivo que o **Excel** abre direto, com acentos e vírgula decimal certinhos.
- O sistema não deixa salvar valores negativos, quantidades zeradas ou campos obrigatórios vazios. Valores podem ser digitados com vírgula (ex.: `18,50`).

### 🏷️ Precificação
1. **Taxas que você paga**: informe a % do iFood e da maquininha de cartão e clique em *Salvar taxas*.
2. **Insumos**: cadastre do jeito que você compra. Exemplos:
   - "Açaí (balde 10 kg)" → valor `180`, quantidade `10`, unidade `kg` → custo calculado: **R$ 18,00/kg · R$ 0,018/g**
   - "Copo 300ml (pct 100)" → valor `35`, quantidade `100`, unidade `unidade` → **R$ 0,35 por unidade**
3. **Produtos**: clique em **+ Novo produto**. Informe quantos **acompanhamentos estão inclusos no preço** (ex.: 3). Na composição, marque cada insumo como **Fixo** (vai em todo pedido: açaí, copo, tampa, colher) ou **Acompanhamento** (só vai se o cliente escolher), com a porção usada naquele tamanho. O custo mostrado é o **custo médio** (fixo + a média dos acompanhamentos inclusos), e o cartão mostra também a faixa (do acompanhamento mais barato ao mais caro). Depois:, dê um nome (ex.: *Açaí 500ml*), o preço de venda e adicione os insumos com a quantidade usada em **uma unidade** do produto (em g, ml ou un — a unidade aparece ao lado do campo). Ex.: açaí 420 g, copo 1 un, tampa 1 un, colher 1 un, leite em pó 20 g…
   - O cartão de cada produto mostra **custo, lucro em R$, margem %, lucro no iFood e lucro no cartão** (já descontando a taxa).
   - Dentro do formulário há o atalho **"Quero margem de X%"** → mostra o preço sugerido e o botão *Usar*.
4. **Atualizou o preço de um insumo?** Basta editar o insumo: **todos os produtos que usam ele são recalculados na hora** (o custo é sempre calculado com o preço atual).
5. **Calculadora de preço sugerido**: escolha um produto (ou digite um custo), informe a margem desejada e veja o preço ideal para venda **sem taxa**, **no cartão** e **no iFood**.

### 📦 Estoque
- Mostra o saldo de cada insumo (em kg, L ou unidades). Os que estão **abaixo do mínimo** ou **zerados** aparecem primeiro, e a aba mostra um número de alerta.
- **Como o saldo muda**: compra de insumo **soma**; cada venda **desconta** os itens fixos do produto + os acompanhamentos escolhidos, multiplicados pela quantidade. Ex.: 1 Açaí 500ml com granola e morango desconta 1 copo 500, 1 tampa 500, 1 colher, 420 g de açaí, 30 g de granola e 50 g de morango.
- Editar ou excluir uma venda/compra **corrige o estoque** automaticamente.
- **Ajustar**: use **Contei** (informe quanto tem de verdade; ótimo para lançar o estoque inicial), **Perda** (caiu, venceu) ou **Entrada** (chegou sem compra).
- O **estoque mínimo** de cada insumo é configurado na aba Precificação → editar insumo.
- O desconto usa a **ficha técnica** (quantidade planejada). Se a porção real for diferente, faça uma contagem de vez em quando para acertar.

### 🧹 Dados de exemplo
Na primeira vez que você entra, o painel cria categorias padrão (Insumos, Embalagens, Limpeza, Aluguel/Contas, Entregas, Marketing, Outros) e alguns dados de exemplo (vendas, compras, insumos e 3 produtos). Quando quiser começar de verdade, clique em **Limpar dados de exemplo** no topo. As categorias e qualquer coisa que **você** cadastrou continuam lá.

## 8. Dúvidas comuns

- **"Falta configurar" ao abrir o painel** → o `.env` (no computador) estava vazio quando você rodou `npm run hostinger`. Preencha o `.env`, gere o zip de novo e reenvie para a Hostinger.
- **"E-mail ou senha incorretos"** → confira o usuário em *Authentication → Users* no Supabase.
- **Erro falando de tabela ou "relation does not exist"** → o SQL do passo 2 não foi rodado (ou foi rodado em outro projeto).
- **Página em branco ou "404" na Hostinger** → o `index.html` precisa estar direto na pasta do domínio/subdomínio, junto com a pasta `assets` (não dentro de uma pasta `dist` ou `site-hostinger`).
- **O projeto gratuito "dormiu"** → no plano Free, o Supabase **pausa projetos sem uso por 7 dias**. Se acontecer, entre em supabase.com, abra o projeto e clique em **Restore project**. Usando o painel toda semana, isso não acontece.
- **Backup**: exporte o CSV de vendas e compras de vez em quando e guarde no seu Drive.

---

### Para quem for mexer no código
- Tecnologias: React + Vite, Supabase (`@supabase/supabase-js`), Recharts.
- Estrutura: `src/components` (telas), `src/lib` (cálculos, formatação, CSV, acesso a dados), `supabase/schema.sql` + `supabase/02_estoque_acompanhamentos.sql` (banco, RLS, gatilho de consumo, view de estoque e dados de exemplo).
- O consumo de cada venda é gravado pelo gatilho `vendas_consumo` na tabela `venda_insumos` (vale também para lançamentos feitos direto por SQL). O estoque é a view `estoque_insumos` = compras + ajustes − consumo.
- Comandos: `npm run dev` (desenvolvimento), `npm run build` (gera a pasta `dist`), `npm run hostinger` (gera a `dist` e o `site-hostinger.zip`).
- O build usa `base: './'` (caminhos relativos), então o site funciona na raiz do domínio ou em qualquer subpasta.
