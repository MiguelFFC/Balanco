-- =====================================================================
-- Balanço Açaí — atualização 2: acompanhamentos nos pedidos e estoque
--
-- COMO USAR: rode DEPOIS do schema.sql. No Supabase, abra "SQL Editor" >
-- "New query", cole TODO este arquivo e clique em "Run".
-- Não apaga nenhum dado. Pode rodar de novo sem problema.
--
-- O que muda:
--  * Ficha técnica: cada insumo do produto é "fixo" (sempre vai: copo,
--    tampa, açaí...) ou "acompanhamento" (só vai se o cliente escolher).
--  * Vendas guardam os acompanhamentos escolhidos.
--  * Compras podem ser ligadas a um insumo e entram no estoque.
--  * Cada venda dá baixa no estoque automaticamente (pela ficha técnica).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Novas colunas
-- ---------------------------------------------------------------------
alter table public.produto_insumos add column if not exists tipo text not null default 'fixo';
alter table public.produtos add column if not exists qtd_acompanhamentos integer not null default 3;
alter table public.insumos add column if not exists estoque_minimo numeric(14,3) not null default 0;
alter table public.vendas add column if not exists acompanhamentos bigint[] not null default '{}';
alter table public.compras add column if not exists insumo_id bigint references public.insumos(id) on delete set null;
alter table public.compras add column if not exists insumo_quantidade numeric(14,3);
create index if not exists compras_insumo_idx on public.compras (insumo_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'produto_insumos_tipo_check') then
    alter table public.produto_insumos add constraint produto_insumos_tipo_check check (tipo in ('fixo','acompanhamento'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'produtos_qtd_acompanhamentos_check') then
    alter table public.produtos add constraint produtos_qtd_acompanhamentos_check check (qtd_acompanhamentos between 0 and 20);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'insumos_estoque_minimo_check') then
    alter table public.insumos add constraint insumos_estoque_minimo_check check (estoque_minimo >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'compras_insumo_quantidade_check') then
    alter table public.compras add constraint compras_insumo_quantidade_check
      check (insumo_quantidade is null or insumo_quantidade > 0);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Ajustes de estoque (contagem, perda, estoque inicial)
-- quantidade na unidade base do insumo; positiva entra, negativa sai
-- ---------------------------------------------------------------------
create table if not exists public.estoque_ajustes (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  insumo_id  bigint not null references public.insumos(id) on delete cascade,
  data       date not null default current_date,
  quantidade numeric(14,3) not null check (quantidade <> 0),
  motivo     text,
  exemplo    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists estoque_ajustes_insumo_idx on public.estoque_ajustes (insumo_id);

-- ---------------------------------------------------------------------
-- Consumo de cada venda (preenchido automaticamente pelo gatilho abaixo)
-- ---------------------------------------------------------------------
create table if not exists public.venda_insumos (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  venda_id       bigint not null references public.vendas(id) on delete cascade,
  insumo_id      bigint not null references public.insumos(id) on delete cascade,
  quantidade     numeric(14,3) not null default 0,
  acompanhamento boolean not null default false
);
create index if not exists venda_insumos_venda_idx on public.venda_insumos (venda_id);
create index if not exists venda_insumos_insumo_idx on public.venda_insumos (insumo_id);

-- RLS das tabelas novas (mesma regra: cada usuário só vê o que é dele)
do $$
declare t text; acao text;
begin
  foreach t in array array['estoque_ajustes','venda_insumos']
  loop
    execute format('alter table public.%I enable row level security', t);
    foreach acao in array array['select','insert','update','delete']
    loop
      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'dono_' || acao) then
        if acao = 'insert' then
          execute format('create policy "dono_insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
        elsif acao = 'update' then
          execute format('create policy "dono_update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
        else
          execute format('create policy "dono_%s" on public.%I for %s to authenticated using (user_id = (select auth.uid()))', acao, t, acao);
        end if;
      end if;
    end loop;
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Gatilho: ao registrar/editar uma venda, calcula o que ela gastou
-- (itens fixos do produto + acompanhamentos escolhidos) × quantidade.
-- O consumo fica gravado: se a ficha técnica mudar depois, as vendas
-- antigas continuam com o consumo da época.
-- ---------------------------------------------------------------------
create or replace function public.calcular_consumo_venda()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    -- produto foi excluído do cadastro: mantém o consumo já registrado
    if new.produto_id is null and old.produto_id is not null
       and new.quantidade = old.quantidade
       and new.acompanhamentos is not distinct from old.acompanhamentos then
      return new;
    end if;
    delete from venda_insumos where venda_id = new.id;
  end if;

  if new.produto_id is null then
    return new;
  end if;

  insert into venda_insumos (user_id, venda_id, insumo_id, quantidade, acompanhamento)
  select new.user_id, new.id, pi.insumo_id, pi.quantidade * new.quantidade, false
  from produto_insumos pi
  where pi.produto_id = new.produto_id and pi.tipo = 'fixo';

  insert into venda_insumos (user_id, venda_id, insumo_id, quantidade, acompanhamento)
  select new.user_id, new.id, a.insumo_id, coalesce(pi.quantidade, 0) * new.quantidade, true
  from (select distinct unnest(new.acompanhamentos) as insumo_id) a
  join insumos i on i.id = a.insumo_id and i.user_id = new.user_id
  left join produto_insumos pi on pi.produto_id = new.produto_id and pi.insumo_id = a.insumo_id;

  return new;
end;
$$;

create or replace trigger vendas_consumo
  after insert or update of produto_id, quantidade, acompanhamentos on public.vendas
  for each row execute function public.calcular_consumo_venda();

-- Vendas antigas (de antes desta atualização) também passam a dar baixa
update public.vendas v set quantidade = v.quantidade
where v.produto_id is not null
  and not exists (select 1 from public.venda_insumos vi where vi.venda_id = v.id);

-- ---------------------------------------------------------------------
-- Estoque atual de cada insumo = compras + ajustes − consumo das vendas
-- ---------------------------------------------------------------------
create or replace view public.estoque_insumos
with (security_invoker = true)
as
select i.id as insumo_id,
       i.user_id,
       coalesce(e.qtd, 0) + coalesce(a.qtd, 0) - coalesce(s.qtd, 0) as estoque,
       coalesce(e.qtd, 0) as entradas,
       coalesce(a.qtd, 0) as ajustes,
       coalesce(s.qtd, 0) as saidas
from public.insumos i
left join (select insumo_id, sum(insumo_quantidade) as qtd from public.compras where insumo_id is not null group by insumo_id) e on e.insumo_id = i.id
left join (select insumo_id, sum(quantidade) as qtd from public.estoque_ajustes group by insumo_id) a on a.insumo_id = i.id
left join (select insumo_id, sum(quantidade) as qtd from public.venda_insumos group by insumo_id) s on s.insumo_id = i.id;

revoke all on public.estoque_insumos from anon;
grant select on public.estoque_insumos to authenticated;

-- ---------------------------------------------------------------------
-- Dados de exemplo (nova versão, com acompanhamentos e estoque)
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
  acomps bigint[];
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

  insert into categorias (user_id, nome)
  select uid, n from unnest(array['Insumos','Embalagens','Limpeza','Aluguel/Contas','Entregas','Marketing','Outros']) as n
  on conflict (user_id, nome) do nothing;

  select id into c_insumos  from categorias where user_id = uid and nome = 'Insumos';
  select id into c_embal    from categorias where user_id = uid and nome = 'Embalagens';
  select id into c_limpeza  from categorias where user_id = uid and nome = 'Limpeza';
  select id into c_contas   from categorias where user_id = uid and nome = 'Aluguel/Contas';
  select id into c_entregas from categorias where user_id = uid and nome = 'Entregas';
  select id into c_mkt      from categorias where user_id = uid and nome = 'Marketing';

  insert into insumos (user_id, nome, valor_pago, quantidade_embalagem, unidade_compra, unidade_base, estoque_minimo, exemplo)
    values (uid, 'Açaí (balde 10 kg)', 180, 10000, 'kg', 'g', 10000, true) returning id into i_acai;
  insert into insumos (user_id, nome, valor_pago, quantidade_embalagem, unidade_compra, unidade_base, estoque_minimo, exemplo)
    values (uid, 'Copo 300ml', 35, 100, 'un', 'un', 50, true) returning id into i_copo300;
  insert into insumos (user_id, nome, valor_pago, quantidade_embalagem, unidade_compra, unidade_base, estoque_minimo, exemplo)
    values (uid, 'Copo 500ml', 45, 100, 'un', 'un', 50, true) returning id into i_copo500;
  insert into insumos (user_id, nome, valor_pago, quantidade_embalagem, unidade_compra, unidade_base, estoque_minimo, exemplo)
    values (uid, 'Tampa 300ml', 18, 100, 'un', 'un', 50, true) returning id into i_tampa300;
  insert into insumos (user_id, nome, valor_pago, quantidade_embalagem, unidade_compra, unidade_base, estoque_minimo, exemplo)
    values (uid, 'Tampa 500ml', 22, 100, 'un', 'un', 50, true) returning id into i_tampa500;
  insert into insumos (user_id, nome, valor_pago, quantidade_embalagem, unidade_compra, unidade_base, estoque_minimo, exemplo)
    values (uid, 'Colher', 30, 500, 'un', 'un', 100, true) returning id into i_colher;
  insert into insumos (user_id, nome, valor_pago, quantidade_embalagem, unidade_compra, unidade_base, estoque_minimo, exemplo)
    values (uid, 'Leite em pó', 38, 1000, 'kg', 'g', 500, true) returning id into i_leitepo;
  insert into insumos (user_id, nome, valor_pago, quantidade_embalagem, unidade_compra, unidade_base, estoque_minimo, exemplo)
    values (uid, 'Leite condensado', 7.5, 395, 'g', 'g', 800, true) returning id into i_condensado;
  insert into insumos (user_id, nome, valor_pago, quantidade_embalagem, unidade_compra, unidade_base, estoque_minimo, exemplo)
    values (uid, 'Granola', 22, 1000, 'kg', 'g', 500, true) returning id into i_granola;
  insert into insumos (user_id, nome, valor_pago, quantidade_embalagem, unidade_compra, unidade_base, estoque_minimo, exemplo)
    values (uid, 'Banana', 7, 1000, 'kg', 'g', 1000, true) returning id into i_banana;
  insert into insumos (user_id, nome, valor_pago, quantidade_embalagem, unidade_compra, unidade_base, estoque_minimo, exemplo)
    values (uid, 'Morango', 24, 1000, 'kg', 'g', 1000, true) returning id into i_morango;

  insert into produtos (user_id, nome, preco_venda, qtd_acompanhamentos, exemplo) values (uid, 'Açaí 300ml', 18, 3, true) returning id into p300;
  insert into produtos (user_id, nome, preco_venda, qtd_acompanhamentos, exemplo) values (uid, 'Açaí 500ml', 26, 3, true) returning id into p500;
  insert into produtos (user_id, nome, preco_venda, qtd_acompanhamentos, exemplo) values (uid, 'Açaí 700ml', 34, 3, true) returning id into p700;

  insert into produto_insumos (user_id, produto_id, insumo_id, quantidade, tipo) values
    (uid, p300, i_acai, 250, 'fixo'), (uid, p300, i_copo300, 1, 'fixo'), (uid, p300, i_tampa300, 1, 'fixo'), (uid, p300, i_colher, 1, 'fixo'),
    (uid, p300, i_leitepo, 15, 'acompanhamento'), (uid, p300, i_condensado, 20, 'acompanhamento'), (uid, p300, i_granola, 20, 'acompanhamento'),
    (uid, p300, i_banana, 40, 'acompanhamento'), (uid, p300, i_morango, 40, 'acompanhamento'),
    (uid, p500, i_acai, 420, 'fixo'), (uid, p500, i_copo500, 1, 'fixo'), (uid, p500, i_tampa500, 1, 'fixo'), (uid, p500, i_colher, 1, 'fixo'),
    (uid, p500, i_leitepo, 20, 'acompanhamento'), (uid, p500, i_condensado, 30, 'acompanhamento'), (uid, p500, i_granola, 30, 'acompanhamento'),
    (uid, p500, i_banana, 50, 'acompanhamento'), (uid, p500, i_morango, 50, 'acompanhamento'),
    (uid, p700, i_acai, 600, 'fixo'), (uid, p700, i_copo500, 1, 'fixo'), (uid, p700, i_tampa500, 1, 'fixo'), (uid, p700, i_colher, 1, 'fixo'),
    (uid, p700, i_leitepo, 25, 'acompanhamento'), (uid, p700, i_condensado, 40, 'acompanhamento'), (uid, p700, i_granola, 40, 'acompanhamento'),
    (uid, p700, i_banana, 60, 'acompanhamento'), (uid, p700, i_morango, 60, 'acompanhamento');

  -- 5 acompanhamentos; cada pedido leva 3 deles (em rodízio)
  acomps := array[i_leitepo, i_condensado, i_granola, i_banana, i_morango];

  -- Vendas de exemplo nos últimos 45 dias (cerca de 8 pedidos por dia)
  insert into vendas (user_id, data, produto_id, produto_nome, quantidade, valor_recebido, canal, taxa_tipo, taxa_valor, forma_pagamento, acompanhamentos, exemplo)
  select uid,
         current_date - d,
         p.id, p.nome,
         q,
         q * p.preco_venda,
         canal,
         case when canal = 'iFood' or fp like 'Cartão%' then 'pct' else 'reais' end,
         case when canal = 'iFood' then 27 when fp like 'Cartão%' then 3.5 else 0 end,
         fp,
         array[acomps[1 + k % 5], acomps[1 + (k + 1 + d % 2) % 5], acomps[1 + (k + 3) % 5]],
         true
  from generate_series(0, 44) as d
  cross join generate_series(1, 6 + (d % 5)) as n
  cross join lateral (select
      (array[p300, p500, p500, p700, p300])[1 + (d + n) % 5] as pid,
      1 + ((d * n) % 7 = 0)::int as q,
      (array['iFood','WhatsApp','Balcão','iFood','WhatsApp','Outros','Balcão'])[1 + (d * 3 + n) % 7] as canal,
      (array['Pix','Cartão de crédito','Dinheiro','Pix','Cartão de débito'])[1 + (d + n * 2) % 5] as fp,
      (d * 7 + n * 3) as k
  ) as v
  join produtos p on p.id = v.pid;

  -- Compras de insumos (entram no estoque)
  insert into compras (user_id, data, item, fornecedor, categoria_id, insumo_id, insumo_quantidade, quantidade, unidade, valor_total, forma_pagamento, exemplo)
  select uid, current_date - d, 'Açaí (balde 10 kg)', 'Distribuidora Pará', c_insumos, i_acai, 30000, 30, 'kg', 540, 'Pix', true
  from generate_series(1, 44, 7) as d;

  insert into compras (user_id, data, item, fornecedor, categoria_id, insumo_id, insumo_quantidade, quantidade, unidade, valor_total, forma_pagamento, exemplo) values
    (uid, current_date - 3,  'Copo 300ml', 'Embalagens Sul', c_embal, i_copo300, 300, 300, 'un', 105, 'Cartão de crédito', true),
    (uid, current_date - 3,  'Tampa 300ml', 'Embalagens Sul', c_embal, i_tampa300, 300, 300, 'un', 54, 'Cartão de crédito', true),
    (uid, current_date - 18, 'Copo 500ml', 'Embalagens Sul', c_embal, i_copo500, 400, 400, 'un', 180, 'Cartão de crédito', true),
    (uid, current_date - 18, 'Tampa 500ml', 'Embalagens Sul', c_embal, i_tampa500, 400, 400, 'un', 88, 'Cartão de crédito', true),
    (uid, current_date - 20, 'Colher', 'Embalagens Sul', c_embal, i_colher, 500, 500, 'un', 30, 'Pix', true),
    (uid, current_date - 5,  'Leite em pó', 'Atacadão', c_insumos, i_leitepo, 3000, 3, 'kg', 114, 'Cartão de débito', true),
    (uid, current_date - 5,  'Leite condensado', 'Atacadão', c_insumos, i_condensado, 4740, 4740, 'g', 90, 'Cartão de débito', true),
    (uid, current_date - 25, 'Granola', 'Atacadão', c_insumos, i_granola, 3000, 3, 'kg', 66, 'Cartão de débito', true),
    (uid, current_date - 2,  'Banana', 'Feira', c_insumos, i_banana, 6000, 6, 'kg', 42, 'Dinheiro', true),
    (uid, current_date - 2,  'Morango', 'Feira', c_insumos, i_morango, 3000, 3, 'kg', 72, 'Dinheiro', true);

  -- Outras despesas (não são insumos)
  insert into compras (user_id, data, item, fornecedor, categoria_id, quantidade, unidade, valor_total, forma_pagamento, observacao, exemplo) values
    (uid, current_date - 10, 'Detergente e sanitizante', 'Mercado', c_limpeza, 1, 'un', 45, 'Pix', null, true),
    (uid, current_date - 8,  'Aluguel', 'Imobiliária', c_contas, 1, 'mês', 1200, 'Pix', 'Exemplo', true),
    (uid, current_date - 38, 'Aluguel', 'Imobiliária', c_contas, 1, 'mês', 1200, 'Pix', 'Exemplo', true),
    (uid, current_date - 42, 'Conta de luz', 'Companhia de energia', c_contas, 1, 'mês', 265, 'Boleto', null, true),
    (uid, current_date - 12, 'Conta de luz', 'Companhia de energia', c_contas, 1, 'mês', 280, 'Boleto', null, true),
    (uid, current_date - 6,  'Motoboy (semana)', 'João Entregas', c_entregas, 1, 'serviço', 250, 'Pix', null, true),
    (uid, current_date - 13, 'Motoboy (semana)', 'João Entregas', c_entregas, 1, 'serviço', 250, 'Pix', null, true),
    (uid, current_date - 9,  'Impulsionamento Instagram', 'Meta', c_mkt, 1, 'serviço', 60, 'Cartão de crédito', null, true);

  -- Estoque inicial: deixa cada insumo com um saldo plausível
  -- (morango e tampa 300 ficam abaixo do mínimo, para mostrar o alerta)
  insert into estoque_ajustes (user_id, insumo_id, data, quantidade, motivo, exemplo)
  select uid, s.insumo_id, current_date - 45,
         alvo - s.estoque,
         'Estoque inicial (exemplo)', true
  from (
    select ei.insumo_id, ei.estoque,
           case when ei.insumo_id in (i_morango, i_tampa300) then round(i.estoque_minimo * 0.6)
                else round(i.estoque_minimo * 2.5) end as alvo
    from estoque_insumos ei
    join insumos i on i.id = ei.insumo_id
    where i.user_id = uid
  ) s
  where alvo - s.estoque <> 0;
end;
$$;

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
  delete from estoque_ajustes where user_id = uid and exemplo;
  delete from produtos where user_id = uid and exemplo;  -- a composição é apagada junto
  -- insumos de exemplo que você passou a usar continuam cadastrados
  delete from insumos i where i.user_id = uid and i.exemplo
    and not exists (select 1 from produto_insumos pi where pi.insumo_id = i.id)
    and not exists (select 1 from compras c where c.insumo_id = i.id)
    and not exists (select 1 from estoque_ajustes a where a.insumo_id = i.id)
    and not exists (select 1 from venda_insumos vi where vi.insumo_id = i.id);
  update insumos set exemplo = false where user_id = uid and exemplo;
  update configuracoes set exemplo_ativo = false where user_id = uid;
end;
$$;

revoke all on function public.carregar_dados_exemplo() from public, anon;
revoke all on function public.limpar_dados_exemplo()   from public, anon;
grant execute on function public.carregar_dados_exemplo() to authenticated;
grant execute on function public.limpar_dados_exemplo()   to authenticated;
