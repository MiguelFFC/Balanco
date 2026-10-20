-- =====================================================================
-- Balanço Açaí — estrutura do banco de dados (Supabase / PostgreSQL)
--
-- COMO USAR: no painel do Supabase, abra "SQL Editor" > "New query",
-- cole TODO este arquivo e clique em "Run". Pode rodar de novo sem medo:
-- o script não apaga dados que já existem.
--
-- Segurança: cada tabela tem Row Level Security (RLS) ligado. Cada
-- usuário logado só enxerga e altera as linhas que ele mesmo criou
-- (coluna user_id). Visitantes sem login não enxergam nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Configurações por usuário (taxas padrão e controle dos dados de exemplo)
-- ---------------------------------------------------------------------
create table if not exists public.configuracoes (
  user_id          uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  taxa_ifood_pct   numeric(6,2) not null default 27  check (taxa_ifood_pct  between 0 and 100),
  taxa_cartao_pct  numeric(6,2) not null default 3.5 check (taxa_cartao_pct between 0 and 100),
  exemplo_ativo    boolean not null default false,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Categorias de gastos
-- ---------------------------------------------------------------------
create table if not exists public.categorias (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome       text not null check (length(trim(nome)) > 0),
  created_at timestamptz not null default now(),
  unique (user_id, nome)
);

-- ---------------------------------------------------------------------
-- Compras (gastos)
-- ---------------------------------------------------------------------
create table if not exists public.compras (
  id              bigint generated always as identity primary key,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data            date not null default current_date,
  item            text not null check (length(trim(item)) > 0),
  fornecedor      text,
  categoria_id    bigint references public.categorias(id) on delete set null,
  quantidade      numeric(12,3) not null default 1 check (quantidade > 0),
  unidade         text not null default 'un',
  valor_total     numeric(12,2) not null check (valor_total >= 0),
  forma_pagamento text,
  observacao      text,
  exemplo         boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists compras_user_data_idx on public.compras (user_id, data);

-- ---------------------------------------------------------------------
-- Insumos (matéria-prima e embalagens usadas nos produtos)
-- quantidade_embalagem fica guardada na unidade base: g, ml ou un.
-- Ex.: balde de 10 kg => unidade_compra 'kg', unidade_base 'g', quantidade 10000
-- ---------------------------------------------------------------------
create table if not exists public.insumos (
  id                   bigint generated always as identity primary key,
  user_id              uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome                 text not null check (length(trim(nome)) > 0),
  valor_pago           numeric(12,2) not null check (valor_pago >= 0),
  quantidade_embalagem numeric(14,3) not null check (quantidade_embalagem > 0),
  unidade_compra       text not null default 'un' check (unidade_compra in ('kg','g','L','ml','un')),
  unidade_base         text not null default 'un' check (unidade_base in ('g','ml','un')),
  custo_unitario       numeric(14,6) generated always as (valor_pago / quantidade_embalagem) stored,
  exemplo              boolean not null default false,
  created_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Produtos (o que você vende)
-- ---------------------------------------------------------------------
create table if not exists public.produtos (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome        text not null check (length(trim(nome)) > 0),
  preco_venda numeric(12,2) not null default 0 check (preco_venda >= 0),
  exemplo     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Composição (ficha técnica): quais insumos e quanto de cada um vai no produto
-- quantidade está na unidade base do insumo (g, ml ou un)
-- ---------------------------------------------------------------------
create table if not exists public.produto_insumos (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  produto_id bigint not null references public.produtos(id) on delete cascade,
  insumo_id  bigint not null references public.insumos(id) on delete restrict,
  quantidade numeric(12,3) not null check (quantidade > 0),
  unique (produto_id, insumo_id)
);
create index if not exists produto_insumos_insumo_idx on public.produto_insumos (insumo_id);

-- ---------------------------------------------------------------------
-- Vendas
-- taxa_tipo: 'reais' (valor fixo em R$) ou 'pct' (% sobre o valor recebido)
-- taxa_reais é calculada automaticamente
-- ---------------------------------------------------------------------
create table if not exists public.vendas (
  id              bigint generated always as identity primary key,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data            date not null default current_date,
  produto_id      bigint references public.produtos(id) on delete set null,
  produto_nome    text not null check (length(trim(produto_nome)) > 0),
  quantidade      numeric(12,3) not null default 1 check (quantidade > 0),
  valor_recebido  numeric(12,2) not null check (valor_recebido >= 0),
  canal           text not null default 'Balcão',
  taxa_tipo       text not null default 'reais' check (taxa_tipo in ('reais','pct')),
  taxa_valor      numeric(12,2) not null default 0 check (taxa_valor >= 0),
  taxa_reais      numeric(12,2) generated always as (
                    case when taxa_tipo = 'pct' then round(valor_recebido * taxa_valor / 100, 2)
                         else taxa_valor end) stored,
  forma_pagamento text,
  observacao      text,
  exemplo         boolean not null default false,
  created_at      timestamptz not null default now(),
  check (taxa_tipo <> 'pct' or taxa_valor <= 100)
);
create index if not exists vendas_user_data_idx on public.vendas (user_id, data);

-- ---------------------------------------------------------------------
-- Row Level Security: só o dono (usuário logado) vê e edita
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['configuracoes','categorias','compras','insumos','produtos','produto_insumos','vendas']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "dono_select" on public.%I', t);
    execute format('drop policy if exists "dono_insert" on public.%I', t);
    execute format('drop policy if exists "dono_update" on public.%I', t);
    execute format('drop policy if exists "dono_delete" on public.%I', t);
    execute format('create policy "dono_select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "dono_insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "dono_update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "dono_delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Função: cria as categorias padrão e carrega os dados de exemplo
-- (chamada automaticamente pelo dashboard no primeiro login)
-- ---------------------------------------------------------------------
create or replace function public.carregar_dados_exemplo()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c_insumos bigint; c_embal bigint; c_limpeza bigint; c_contas bigint; c_entregas bigint; c_mkt bigint;
  i_acai bigint; i_copo300 bigint; i_copo500 bigint; i_tampa300 bigint; i_tampa500 bigint;
  i_colher bigint; i_leitepo bigint; i_condensado bigint; i_granola bigint; i_banana bigint; i_morango bigint;
  p300 bigint; p500 bigint; p700 bigint;
begin
  if uid is null then
    raise exception 'É preciso estar logado';
  end if;

  -- Já carregou antes? Não faz nada. (o "on conflict" também protege
  -- contra duas chamadas ao mesmo tempo)
  insert into configuracoes (user_id, exemplo_ativo) values (uid, true)
  on conflict (user_id) do nothing;
  if not found then
    return;
  end if;

  -- Categorias padrão (estas ficam mesmo depois de limpar os exemplos)
  insert into categorias (user_id, nome)
  select uid, n from unnest(array['Insumos','Embalagens','Limpeza','Aluguel/Contas','Entregas','Marketing','Outros']) as n
  on conflict (user_id, nome) do nothing;

  select id into c_insumos  from categorias where user_id = uid and nome = 'Insumos';
  select id into c_embal    from categorias where user_id = uid and nome = 'Embalagens';
  select id into c_limpeza  from categorias where user_id = uid and nome = 'Limpeza';
  select id into c_contas   from categorias where user_id = uid and nome = 'Aluguel/Contas';
  select id into c_entregas from categorias where user_id = uid and nome = 'Entregas';
  select id into c_mkt      from categorias where user_id = uid and nome = 'Marketing';

  -- Insumos de exemplo
  insert into insumos (user_id, nome, valor_pago, quantidade_embalagem, unidade_compra, unidade_base, exemplo)
    values (uid, 'Açaí (balde 10 kg)', 180, 10000, 'kg', 'g', true) returning id into i_acai;
  insert into insumos (user_id, nome, valor_pago, quantidade_embalagem, unidade_compra, unidade_base, exemplo)
    values (uid, 'Copo 300ml (pct 100)', 35, 100, 'un', 'un', true) returning id into i_copo300;
  insert into insumos (user_id, nome, valor_pago, quantidade_embalagem, unidade_compra, unidade_base, exemplo)
    values (uid, 'Copo 500ml (pct 100)', 45, 100, 'un', 'un', true) returning id into i_copo500;
  insert into insumos (user_id, nome, valor_pago, quantidade_embalagem, unidade_compra, unidade_base, exemplo)
    values (uid, 'Tampa 300ml (pct 100)', 18, 100, 'un', 'un', true) returning id into i_tampa300;
  insert into insumos (user_id, nome, valor_pago, quantidade_embalagem, unidade_compra, unidade_base, exemplo)
    values (uid, 'Tampa 500ml (pct 100)', 22, 100, 'un', 'un', true) returning id into i_tampa500;
  insert into insumos (user_id, nome, valor_pago, quantidade_embalagem, unidade_compra, unidade_base, exemplo)
    values (uid, 'Colher (pct 500)', 30, 500, 'un', 'un', true) returning id into i_colher;
  insert into insumos (user_id, nome, valor_pago, quantidade_embalagem, unidade_compra, unidade_base, exemplo)
    values (uid, 'Leite em pó (1 kg)', 38, 1000, 'kg', 'g', true) returning id into i_leitepo;
  insert into insumos (user_id, nome, valor_pago, quantidade_embalagem, unidade_compra, unidade_base, exemplo)
    values (uid, 'Leite condensado (395 g)', 7.5, 395, 'g', 'g', true) returning id into i_condensado;
  insert into insumos (user_id, nome, valor_pago, quantidade_embalagem, unidade_compra, unidade_base, exemplo)
    values (uid, 'Granola (1 kg)', 22, 1000, 'kg', 'g', true) returning id into i_granola;
  insert into insumos (user_id, nome, valor_pago, quantidade_embalagem, unidade_compra, unidade_base, exemplo)
    values (uid, 'Banana (1 kg)', 7, 1000, 'kg', 'g', true) returning id into i_banana;
  insert into insumos (user_id, nome, valor_pago, quantidade_embalagem, unidade_compra, unidade_base, exemplo)
    values (uid, 'Morango (1 kg)', 24, 1000, 'kg', 'g', true) returning id into i_morango;

  -- Produtos de exemplo
  insert into produtos (user_id, nome, preco_venda, exemplo) values (uid, 'Açaí 300ml', 18, true) returning id into p300;
  insert into produtos (user_id, nome, preco_venda, exemplo) values (uid, 'Açaí 500ml', 26, true) returning id into p500;
  insert into produtos (user_id, nome, preco_venda, exemplo) values (uid, 'Açaí 700ml', 34, true) returning id into p700;

  insert into produto_insumos (user_id, produto_id, insumo_id, quantidade) values
    (uid, p300, i_acai, 250), (uid, p300, i_copo300, 1), (uid, p300, i_tampa300, 1), (uid, p300, i_colher, 1),
    (uid, p300, i_leitepo, 15), (uid, p300, i_condensado, 20), (uid, p300, i_granola, 20), (uid, p300, i_banana, 40),
    (uid, p500, i_acai, 420), (uid, p500, i_copo500, 1), (uid, p500, i_tampa500, 1), (uid, p500, i_colher, 1),
    (uid, p500, i_leitepo, 20), (uid, p500, i_condensado, 30), (uid, p500, i_granola, 30), (uid, p500, i_morango, 50),
    (uid, p700, i_acai, 600), (uid, p700, i_copo500, 1), (uid, p700, i_tampa500, 1), (uid, p700, i_colher, 1),
    (uid, p700, i_leitepo, 25), (uid, p700, i_condensado, 40), (uid, p700, i_granola, 40), (uid, p700, i_morango, 60);

  -- Vendas de exemplo nos últimos 45 dias (cerca de 8 pedidos por dia)
  insert into vendas (user_id, data, produto_id, produto_nome, quantidade, valor_recebido, canal, taxa_tipo, taxa_valor, forma_pagamento, exemplo)
  select uid,
         current_date - d,
         p.id, p.nome,
         q,
         q * p.preco_venda,
         canal,
         case when canal = 'iFood' or fp like 'Cartão%' then 'pct' else 'reais' end,
         case when canal = 'iFood' then 27 when fp like 'Cartão%' then 3.5 else 0 end,
         fp,
         true
  from generate_series(0, 44) as d
  cross join generate_series(1, 6 + (d % 5)) as n
  cross join lateral (select
      (array[p300, p500, p500, p700, p300])[1 + (d + n) % 5] as pid,
      1 + ((d * n) % 7 = 0)::int as q,
      (array['iFood','WhatsApp','Balcão','iFood','WhatsApp','Outros','Balcão'])[1 + (d * 3 + n) % 7] as canal,
      (array['Pix','Cartão de crédito','Dinheiro','Pix','Cartão de débito'])[1 + (d + n * 2) % 5] as fp
  ) as v
  join produtos p on p.id = v.pid;

  -- Compras de exemplo
  insert into compras (user_id, data, item, fornecedor, categoria_id, quantidade, unidade, valor_total, forma_pagamento, exemplo)
  select uid, current_date - d, 'Açaí (balde 10 kg)', 'Distribuidora Pará', c_insumos, 2, 'balde', 360, 'Pix', true
  from generate_series(1, 44, 7) as d;

  insert into compras (user_id, data, item, fornecedor, categoria_id, quantidade, unidade, valor_total, forma_pagamento, observacao, exemplo) values
    (uid, current_date - 3,  'Copos e tampas', 'Embalagens Sul', c_embal, 4, 'pct', 120, 'Cartão de crédito', null, true),
    (uid, current_date - 18, 'Copos e tampas', 'Embalagens Sul', c_embal, 4, 'pct', 120, 'Cartão de crédito', null, true),
    (uid, current_date - 5,  'Granola, leite em pó e condensado', 'Atacadão', c_insumos, 1, 'compra', 210, 'Cartão de débito', null, true),
    (uid, current_date - 25, 'Granola, leite em pó e condensado', 'Atacadão', c_insumos, 1, 'compra', 195, 'Cartão de débito', null, true),
    (uid, current_date - 2,  'Frutas (banana e morango)', 'Feira', c_insumos, 1, 'compra', 85, 'Dinheiro', null, true),
    (uid, current_date - 16, 'Frutas (banana e morango)', 'Feira', c_insumos, 1, 'compra', 90, 'Dinheiro', null, true),
    (uid, current_date - 10, 'Detergente e sanitizante', 'Mercado', c_limpeza, 1, 'compra', 45, 'Pix', null, true),
    (uid, current_date - 8,  'Aluguel', 'Imobiliária', c_contas, 1, 'mês', 1200, 'Pix', 'Exemplo', true),
    (uid, current_date - 38, 'Aluguel', 'Imobiliária', c_contas, 1, 'mês', 1200, 'Pix', 'Exemplo', true),
    (uid, current_date - 42, 'Conta de luz', 'Companhia de energia', c_contas, 1, 'mês', 265, 'Boleto', null, true),
    (uid, current_date - 12, 'Conta de luz', 'Companhia de energia', c_contas, 1, 'mês', 280, 'Boleto', null, true),
    (uid, current_date - 6,  'Motoboy (semana)', 'João Entregas', c_entregas, 1, 'semana', 250, 'Pix', null, true),
    (uid, current_date - 13, 'Motoboy (semana)', 'João Entregas', c_entregas, 1, 'semana', 250, 'Pix', null, true),
    (uid, current_date - 9,  'Impulsionamento Instagram', 'Meta', c_mkt, 1, 'campanha', 60, 'Cartão de crédito', null, true);
end;
$$;

-- ---------------------------------------------------------------------
-- Função: apaga somente os dados de exemplo
-- ---------------------------------------------------------------------
create or replace function public.limpar_dados_exemplo()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'É preciso estar logado';
  end if;

  delete from vendas  where user_id = uid and exemplo;
  delete from compras where user_id = uid and exemplo;
  delete from produtos where user_id = uid and exemplo;  -- a composição é apagada junto
  -- insumos de exemplo que você usou em produtos seus continuam cadastrados
  delete from insumos i where i.user_id = uid and i.exemplo
    and not exists (select 1 from produto_insumos pi where pi.insumo_id = i.id);
  update insumos set exemplo = false where user_id = uid and exemplo;
  update configuracoes set exemplo_ativo = false where user_id = uid;
end;
$$;

revoke all on function public.carregar_dados_exemplo() from public, anon;
revoke all on function public.limpar_dados_exemplo()   from public, anon;
grant execute on function public.carregar_dados_exemplo() to authenticated;
grant execute on function public.limpar_dados_exemplo()   to authenticated;
