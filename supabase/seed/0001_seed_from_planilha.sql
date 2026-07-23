-- ================================================================
-- Seed: migração da planilha antiga "Controle de Pagamentos" (2026/1 a 2026/6)
-- ================================================================
-- O que este script faz:
--   1. Cadastra os 10 alunos da planilha em `students`
--   2. Lança os pagamentos de aula já recebidos em `payments`
--   3. Lança as outras receitas (K.Education, YouTube) em `transactions`
--   4. Lança as despesas do negócio (Zoom, Unimed, Salário, etc.) em `transactions`
--
-- O que NÃO é migrado (a planilha antiga não tinha esse detalhe):
--   - Horário/data de cada aula individual (a planilha só tinha totais
--     mensais por aluno) — as aulas precisam ser cadastradas daqui pra
--     frente pelo módulo "Aulas"
--   - WhatsApp, e-mail, nível e objetivo de cada aluno — ficam em
--     branco, você pode preencher depois editando o aluno no app
--   - 2 lançamentos que estavam como "pendente" na planilha (Aura
--     YouTube de janeiro, R$ 870,00, e K.Education de abril, R$
--     3.000,00) foram propositalmente deixados de fora — como não
--     dá pra saber se já foram pagos, é mais seguro você lançar
--     esses dois manualmente pelo app quando tiver certeza do status
--
-- Como rodar (passo a passo para quem nunca usou SQL):
--   1. Crie sua conta no app pelo menos uma vez (tela de login) ANTES
--      de rodar este script — ele precisa que você já exista em
--      "Authentication" no Supabase.
--   2. No painel do Supabase, vá em "SQL Editor" (menu da esquerda)
--   3. Clique em "New query"
--   4. Cole todo o conteúdo deste arquivo
--   5. Clique em "Run" (ou Ctrl/Cmd+Enter)
--   6. Se aparecer "Success. No rows returned", deu tudo certo.
--   7. Pode rodar este script mais de uma vez sem medo — ele não
--      duplica dados que já existem.
--
-- Valores de referência dos alunos (rate_value) foram preenchidos com
-- o valor mais recente pago por cada um. A data de início (start_date)
-- foi estimada como o primeiro mês em que aparecem pagamentos na
-- planilha — ajuste em "Alunos" no app se souber a data real.
-- ================================================================

do $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from auth.users order by created_at asc limit 1;
  if v_user_id is null then
    raise exception 'Nenhum usuário encontrado em auth.users. Crie sua conta no app (tela de login) antes de rodar este seed.';
  end if;

  -- ============================================================
  -- 1. Alunos
  -- ============================================================
  insert into students (user_id, name, rate_type, rate_value, start_date, status)
  select v_user_id, v.name, 'package', v.rate_value, v.start_date, 'active'
  from (values
    ('Thamires',   409.50::numeric, date '2026-01-01'),
    ('Jaque',      520.00::numeric, date '2026-01-01'),
    ('Larissa',    450.00::numeric, date '2026-01-01'),
    ('Bárbara',   1000.00::numeric, date '2026-01-01'),
    ('Vivian',     520.00::numeric, date '2026-01-01'),
    ('Gabriel',    455.00::numeric, date '2026-01-01'),
    ('Day',        295.90::numeric, date '2026-01-01'),
    ('Israelle',   455.00::numeric, date '2026-01-01'),
    ('Letícia',    455.00::numeric, date '2026-02-01'),
    ('Ana Helena', 455.00::numeric, date '2026-05-01')
  ) as v(name, rate_value, start_date)
  where not exists (
    select 1 from students s where s.user_id = v_user_id and s.name = v.name
  );

  -- ============================================================
  -- 2. Pagamentos de alunos (todos já registrados como "pago" na
  --    planilha original — meses marcados como "sem cobrança" foram
  --    propositalmente omitidos, pois não representam um pagamento)
  -- ============================================================
  insert into payments (user_id, student_id, amount, reference_month, status, paid_at)
  select v_user_id, s.id, v.amount, v.reference_month, 'paid',
         (v.reference_month + (v.pay_day - 1) * interval '1 day')::timestamptz
  from (values
    ('Thamires', date '2026-01-01', 409.5, 10),
    ('Thamires', date '2026-02-01', 409.5, 10),
    ('Thamires', date '2026-03-01', 409.5, 10),
    ('Thamires', date '2026-04-01', 409.5, 10),
    ('Thamires', date '2026-05-01', 409.5, 10),
    ('Thamires', date '2026-06-01', 409.5, 10),
    ('Jaque',    date '2026-01-01', 520.0, 10),
    ('Jaque',    date '2026-02-01', 520.0, 10),
    ('Jaque',    date '2026-03-01', 520.0, 10),
    ('Jaque',    date '2026-04-01', 520.0, 10),
    ('Jaque',    date '2026-05-01', 520.0, 10),
    ('Jaque',    date '2026-06-01', 520.0, 10),
    ('Larissa',  date '2026-02-01', 450.0, 10),
    ('Larissa',  date '2026-03-01', 450.0, 10),
    ('Larissa',  date '2026-04-01', 450.0, 10),
    ('Larissa',  date '2026-05-01', 450.0, 10),
    ('Larissa',  date '2026-06-01', 450.0, 10),
    ('Bárbara',  date '2026-04-01', 455.0, 10),
    ('Bárbara',  date '2026-06-01', 1000.0, 10),
    ('Vivian',   date '2026-01-01', 520.0, 31),
    ('Vivian',   date '2026-02-01', 520.0, 31),
    ('Vivian',   date '2026-03-01', 520.0, 31),
    ('Vivian',   date '2026-04-01', 520.0, 31),
    ('Gabriel',  date '2026-01-01', 455.0, 15),
    ('Gabriel',  date '2026-02-01', 455.0, 15),
    ('Gabriel',  date '2026-03-01', 455.0, 15),
    ('Gabriel',  date '2026-04-01', 455.0, 15),
    ('Gabriel',  date '2026-05-01', 455.0, 15),
    ('Gabriel',  date '2026-06-01', 455.0, 15),
    ('Day',      date '2026-01-01', 282.0, 20),
    ('Day',      date '2026-02-01', 282.0, 20),
    ('Day',      date '2026-03-01', 282.0, 20),
    ('Day',      date '2026-04-01', 295.9, 20),
    ('Day',      date '2026-05-01', 295.9, 20),
    ('Day',      date '2026-06-01', 295.9, 20),
    ('Israelle', date '2026-01-01', 455.0, 15),
    ('Israelle', date '2026-02-01', 455.0, 15),
    ('Israelle', date '2026-03-01', 455.0, 15),
    ('Israelle', date '2026-04-01', 455.0, 15),
    ('Letícia',  date '2026-02-01', 455.0, 20),
    ('Letícia',  date '2026-03-01', 455.0, 15),
    ('Letícia',  date '2026-04-01', 455.0, 15),
    ('Letícia',  date '2026-05-01', 455.0, 15),
    ('Letícia',  date '2026-06-01', 455.0, 15),
    ('Ana Helena', date '2026-05-01', 455.0, 10),
    ('Ana Helena', date '2026-06-01', 455.0, 10)
  ) as v(student_name, reference_month, amount, pay_day)
  join students s on s.user_id = v_user_id and s.name = v.student_name
  where not exists (
    select 1 from payments p
    where p.user_id = v_user_id and p.student_id = s.id and p.reference_month = v.reference_month
  );

  -- ============================================================
  -- 3. Outras receitas (K.Education, YouTube) → transactions (income)
  --    (o lançamento "pendente" de K.Education/abril foi omitido de propósito)
  -- ============================================================
  insert into transactions (user_id, type, category, amount, description, occurred_on)
  select v_user_id, 'income', v.source, v.amount,
         v.source || ' - ' || to_char(v.reference_month, 'MM/YYYY'),
         (v.reference_month + (coalesce(v.recv_day, 1) - 1) * interval '1 day')::date
  from (values
    ('K.Education', date '2026-01-01', 3000.0, 15),
    ('K.Education', date '2026-02-01', 3000.0, 15),
    ('K.Education', date '2026-03-01', 3000.0, 15),
    ('K.Education', date '2026-05-01', 3000.0, 15),
    ('K.Education', date '2026-06-01', 3000.0, 15),
    ('YouTube',      date '2026-04-01', 542.22, null),
    ('YouTube',      date '2026-06-01', 517.52, 22)
  ) as v(source, reference_month, amount, recv_day)
  where not exists (
    select 1 from transactions t
    where t.user_id = v_user_id and t.type = 'income' and t.category = v.source
      and t.amount = v.amount
      and t.occurred_on = (v.reference_month + (coalesce(v.recv_day, 1) - 1) * interval '1 day')::date
  );

  -- ============================================================
  -- 4. Despesas do negócio → transactions (expense)
  --    (o lançamento "pendente" de Aura YouTube/janeiro foi omitido de propósito)
  -- ============================================================
  insert into transactions (user_id, type, category, amount, description, occurred_on)
  select v_user_id, 'expense', v.category, v.amount,
         v.category || ' - ' || to_char(v.reference_month, 'MM/YYYY'),
         (v.reference_month + (coalesce(v.pay_day, 1) - 1) * interval '1 day')::date
  from (values
    ('Zoom', date '2026-01-01', 80.0, null),
    ('Zoom', date '2026-02-01', 80.2, null),
    ('Zoom', date '2026-03-01', 80.21, null),
    ('Zoom', date '2026-04-01', 80.0, null),
    ('Zoom', date '2026-05-01', 80.0, null),
    ('Zoom', date '2026-06-01', 80.2, null),
    ('Aura YouTube', date '2026-02-01', 870.0, null),
    ('Aura YouTube', date '2026-03-01', 1120.0, null),
    ('Aura YouTube', date '2026-04-01', 870.0, null),
    ('Aura YouTube', date '2026-05-01', 870.0, null),
    ('Aura YouTube', date '2026-06-01', 870.0, null),
    ('Gastos Extras', date '2026-06-01', 334.6, null),
    ('iCloud', date '2026-01-01', 14.9, null),
    ('iCloud', date '2026-02-01', 14.9, null),
    ('iCloud', date '2026-03-01', 14.9, null),
    ('iCloud', date '2026-04-01', 14.9, null),
    ('iCloud', date '2026-05-01', 14.9, null),
    ('iCloud', date '2026-06-01', 14.9, null),
    ('DAS', date '2026-01-01', 80.9, null),
    ('DAS', date '2026-02-01', 86.05, null),
    ('DAS', date '2026-03-01', 86.05, null),
    ('DAS', date '2026-04-01', 86.05, null),
    ('DAS', date '2026-05-01', 86.05, 8),
    ('DAS', date '2026-06-01', 86.05, null),
    ('Unimed', date '2026-01-01', 355.77, 20),
    ('Unimed', date '2026-02-01', 355.77, 20),
    ('Unimed', date '2026-03-01', 355.77, 20),
    ('Unimed', date '2026-04-01', 355.77, 20),
    ('Unimed', date '2026-05-01', 355.77, 20),
    ('Unimed', date '2026-06-01', 355.77, 20),
    ('Salário', date '2026-01-01', 3500.0, 20),
    ('Salário', date '2026-02-01', 3500.0, 1),
    ('Salário', date '2026-03-01', 3500.0, 2),
    ('Salário', date '2026-04-01', 3750.0, 20),
    ('Salário', date '2026-05-01', 3750.0, 20),
    ('Salário', date '2026-06-01', 3775.71, 20)
  ) as v(category, reference_month, amount, pay_day)
  where not exists (
    select 1 from transactions t
    where t.user_id = v_user_id and t.type = 'expense' and t.category = v.category
      and t.amount = v.amount
      and t.occurred_on = (v.reference_month + (coalesce(v.pay_day, 1) - 1) * interval '1 day')::date
  );

end $$;
