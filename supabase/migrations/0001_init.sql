-- Teacher Laís HQ — schema inicial
-- Convenção: toda tabela tem user_id (auth.uid()) e RLS restringindo a own rows.
-- App é de uso pessoal (single-user), mas mantemos user_id/RLS por segurança e
-- para permitir multi-dispositivo/futura expansão sem re-modelar depois.

create extension if not exists "pgcrypto";

-- =========================================================
-- FASE 1: Alunos, Aulas, Pagamentos
-- =========================================================

create table students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  whatsapp text,
  email text,
  level text, -- CEFR (A1..C2) ou livre
  objective text,
  rate_type text not null default 'per_class' check (rate_type in ('per_class', 'package')),
  rate_value numeric(10,2) not null default 0,
  package_classes_total int, -- quando rate_type = 'package'
  start_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index students_user_id_idx on students(user_id);

create table classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  scheduled_at timestamptz not null,
  duration_minutes int not null default 60,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'canceled', 'rescheduled')),
  recurrence_rule text, -- ex.: 'weekly', 'biweekly', null = avulsa
  recurrence_parent_id uuid references classes(id) on delete set null, -- aula "mãe" que gerou a série
  zoom_meeting_id text,
  zoom_join_url text,
  zoom_start_url text,
  zoom_sync_status text not null default 'not_synced' check (zoom_sync_status in ('not_synced', 'synced', 'error', 'pending')),
  zoom_last_synced_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index classes_user_id_idx on classes(user_id);
create index classes_student_id_idx on classes(student_id);
create index classes_scheduled_at_idx on classes(scheduled_at);

create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  class_id uuid references classes(id) on delete set null,
  amount numeric(10,2) not null,
  reference_month date, -- primeiro dia do mês de referência, para pacotes/mensalidades
  status text not null default 'pending' check (status in ('paid', 'pending', 'late')),
  due_date date,
  paid_at timestamptz,
  payment_method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_user_id_idx on payments(user_id);
create index payments_student_id_idx on payments(student_id);
create index payments_status_idx on payments(status);

-- =========================================================
-- FASE 2: Conteúdo & Metas
-- =========================================================

create table content_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  format text check (format in ('short', 'long')),
  platform text check (platform in ('youtube', 'instagram', 'tiktok', 'outro')),
  status text not null default 'idea' check (status in ('idea', 'script', 'recording', 'editing', 'published')),
  planned_publish_date date,
  published_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_items_user_id_idx on content_items(user_id);
create index content_items_status_idx on content_items(status);

create table content_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_type text not null check (period_type in ('week', 'month')),
  target_count int not null,
  period_start date not null,
  period_end date not null,
  streak_count int not null default 0,
  created_at timestamptz not null default now()
);
create index content_goals_user_id_idx on content_goals(user_id);

create table content_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  produced_count int not null default 0,
  target_count int,
  summary text,
  next_steps text,
  created_at timestamptz not null default now()
);
create index content_reports_user_id_idx on content_reports(user_id);

-- =========================================================
-- FASE 3: Financeiro geral, Marketing/Infoproduto, Produção
-- =========================================================

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  category text not null, -- classes, infoproduct, brand_deal, other_income, equipment, editing, ads, platform, other_expense...
  amount numeric(10,2) not null,
  description text,
  occurred_on date not null default current_date,
  payment_id uuid references payments(id) on delete set null, -- vincula receita de aula ao pagamento de origem
  created_at timestamptz not null default now()
);
create index transactions_user_id_idx on transactions(user_id);
create index transactions_occurred_on_idx on transactions(occurred_on);
create index transactions_type_idx on transactions(type);

create table settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  mei_annual_limit numeric(12,2) not null default 81000,
  mei_tolerance_pct numeric(5,2) not null default 20,
  mei_alert_thresholds int[] not null default array[70, 85, 95],
  updated_at timestamptz not null default now()
);

create table marketing_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  contact text,
  stage text not null default 'lead' check (stage in ('lead', 'qualificado', 'proposta', 'convertido', 'perdido')),
  value numeric(10,2),
  launch_name text, -- ex.: campanha/lançamento do Fluência Sem Medo
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index marketing_leads_user_id_idx on marketing_leads(user_id);

create table social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_date date not null,
  platform text not null check (platform in ('youtube', 'instagram', 'tiktok', 'outro')),
  theme text not null,
  status text not null default 'planned' check (status in ('planned', 'posted')),
  content_item_id uuid references content_items(id) on delete set null,
  created_at timestamptz not null default now()
);
create index social_posts_user_id_idx on social_posts(user_id);

create table brand_deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_name text not null,
  status text not null default 'contatado' check (status in ('contatado', 'negociando', 'fechado', 'recusado')),
  value numeric(10,2),
  contact_date date default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index brand_deals_user_id_idx on brand_deals(user_id);

create table production_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_item_id uuid references content_items(id) on delete cascade,
  checklist jsonb not null default '{"roteiro": false, "gravado": false, "editado": false, "thumbnail": false, "legenda": false, "publicado": false}',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index production_items_user_id_idx on production_items(user_id);

-- =========================================================
-- FASE 4: Tarefas, Ponto, Gamificação
-- =========================================================

create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null check (category in ('manual', 'criativa')),
  priority text not null default 'media' check (priority in ('baixa', 'media', 'alta')),
  due_date date,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  linked_content_id uuid references content_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_user_id_idx on tasks(user_id);
create index tasks_status_idx on tasks(status);

create table work_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text check (category in ('aulas', 'gravacao', 'edicao', 'administrativo', 'roteiro', 'outro')),
  task_id uuid references tasks(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes int,
  notes text,
  created_at timestamptz not null default now()
);
create index work_sessions_user_id_idx on work_sessions(user_id);
create index work_sessions_started_at_idx on work_sessions(started_at);

create table achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  milestone_type text, -- content, financeiro, aulas_em_dia...
  unlocked_at timestamptz not null default now()
);
create index achievements_user_id_idx on achievements(user_id);

create table rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  milestone_description text,
  achieved boolean not null default false,
  achieved_at timestamptz,
  created_at timestamptz not null default now()
);
create index rewards_user_id_idx on rewards(user_id);

-- =========================================================
-- Triggers: updated_at automático
-- =========================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on students
  for each row execute function set_updated_at();
create trigger set_updated_at before update on classes
  for each row execute function set_updated_at();
create trigger set_updated_at before update on payments
  for each row execute function set_updated_at();
create trigger set_updated_at before update on content_items
  for each row execute function set_updated_at();
create trigger set_updated_at before update on marketing_leads
  for each row execute function set_updated_at();
create trigger set_updated_at before update on brand_deals
  for each row execute function set_updated_at();
create trigger set_updated_at before update on production_items
  for each row execute function set_updated_at();
create trigger set_updated_at before update on tasks
  for each row execute function set_updated_at();
create trigger set_updated_at before update on settings
  for each row execute function set_updated_at();

-- =========================================================
-- Row Level Security — cada usuário só acessa suas próprias linhas
-- =========================================================

alter table students enable row level security;
alter table classes enable row level security;
alter table payments enable row level security;
alter table content_items enable row level security;
alter table content_goals enable row level security;
alter table content_reports enable row level security;
alter table transactions enable row level security;
alter table settings enable row level security;
alter table marketing_leads enable row level security;
alter table social_posts enable row level security;
alter table brand_deals enable row level security;
alter table production_items enable row level security;
alter table tasks enable row level security;
alter table work_sessions enable row level security;
alter table achievements enable row level security;
alter table rewards enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'students', 'classes', 'payments', 'content_items', 'content_goals',
    'content_reports', 'transactions', 'marketing_leads', 'social_posts',
    'brand_deals', 'production_items', 'tasks', 'work_sessions',
    'achievements', 'rewards'
  ]
  loop
    execute format(
      'create policy "own_rows_select" on %I for select using (auth.uid() = user_id);
       create policy "own_rows_insert" on %I for insert with check (auth.uid() = user_id);
       create policy "own_rows_update" on %I for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
       create policy "own_rows_delete" on %I for delete using (auth.uid() = user_id);',
      t, t, t, t
    );
  end loop;
end $$;

create policy "own_settings_select" on settings for select using (auth.uid() = user_id);
create policy "own_settings_insert" on settings for insert with check (auth.uid() = user_id);
create policy "own_settings_update" on settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Cria settings padrão automaticamente ao criar o usuário
create or replace function handle_new_user_settings()
returns trigger as $$
begin
  insert into public.settings (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created_settings
  after insert on auth.users
  for each row execute function handle_new_user_settings();
