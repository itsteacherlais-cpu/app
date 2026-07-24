-- Dia de vencimento fixo por aluno (usado para gerar os pagamentos do
-- mês automaticamente, com o vencimento no dia certo pra cada um).
alter table students
  add column payment_due_day int not null default 10 check (payment_due_day between 1 and 31);

-- Contratos: quantas aulas o aluno contratou e por quanto tempo, pra
-- gerar o lembrete de "vence em até 30 dias" no dashboard.
create table contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  classes_contracted int,
  duration_months int not null,
  start_date date not null default current_date,
  end_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contracts_user_id_idx on contracts(user_id);
create index contracts_student_id_idx on contracts(student_id);
create index contracts_end_date_idx on contracts(end_date);

create trigger set_updated_at before update on contracts
  for each row execute function set_updated_at();

alter table contracts enable row level security;
create policy "own_rows_select" on contracts for select using (auth.uid() = user_id);
create policy "own_rows_insert" on contracts for insert with check (auth.uid() = user_id);
create policy "own_rows_update" on contracts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_rows_delete" on contracts for delete using (auth.uid() = user_id);
