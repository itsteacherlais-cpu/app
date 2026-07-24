-- Cache diário das sugestões de conteúdo (temas em alta + ideias geradas por IA).
-- Uma linha por dia por usuária, pra não chamar a API de novo toda vez que
-- ela abre o app no mesmo dia.
create table daily_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  suggestion_date date not null,
  items jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (user_id, suggestion_date)
);
create index daily_suggestions_user_id_idx on daily_suggestions(user_id);

alter table daily_suggestions enable row level security;
create policy "own_rows_select" on daily_suggestions for select using (auth.uid() = user_id);
create policy "own_rows_insert" on daily_suggestions for insert with check (auth.uid() = user_id);
create policy "own_rows_update" on daily_suggestions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_rows_delete" on daily_suggestions for delete using (auth.uid() = user_id);
