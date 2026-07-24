# Teacher Laís HQ

App de gestão do negócio da Teacher Laís (aulas particulares, conteúdo, infoproduto e finanças).

**Stack:** React + Tailwind CSS + Supabase (Postgres/Auth/Storage) + Vercel + PWA.

## Status do projeto

Este projeto está sendo construído em fases. **Fases 1, 2, 3 e 4 concluídas — todos os módulos do pedido original estão implementados:**

- Estrutura do app (React + Tailwind v4 + PWA instalável)
- Autenticação (e-mail/senha ou link mágico via Supabase Auth)
- Schema completo do banco (todas as fases já modeladas, com RLS)
- Módulo **Alunos** (cadastro, edição, busca)
- Módulo **Aulas/Calendário** (visão semana/mês, aulas avulsas ou recorrentes, integração com Zoom)
- Módulo **Pagamentos** (status por aula/pacote, marcação manual, alerta de atraso, resumo do mês)
- Módulo **Conteúdo** (quadro Kanban Ideia → Roteiro → Gravação → Edição → Publicado)
- **Metas semanais/mensais** de conteúdo com barra de progresso e metas escalonadas (sugere aumentar a meta após 3 ciclos seguidos batidos)
- **Relatórios periódicos** (o que foi produzido, o que faltou, próximos passos) gerados ao "fechar o ciclo" de uma meta
- Módulo **Financeiro** (lançamentos de receita/despesa, resumo do mês, gráfico de evolução dos últimos 6 meses)
- **Controle de limite MEI** configurável (tela de Configurações), com soma automática do faturamento do ano, alertas por patamar (70/85/95%) e projeção de quando o teto seria atingido no ritmo atual
- Módulo **Marketing & Infoproduto** (funil de leads/conversão, calendário de postagens em redes sociais, prospecção de parcerias/brand deals)
- Módulo **Produção & Edição** (checklist técnico por vídeo com alerta de atraso)
- **Contratos por aluno** (aulas contratadas, duração em meses) com aba própria em Alunos e alerta no Dashboard quando vence em até 30 dias
- **Geração automática dos pagamentos do mês**: ao abrir Pagamentos, cria sozinho os lançamentos pendentes do mês pra cada aluno ativo (usando o dia de vencimento configurado em cada aluno), sem precisar cadastrar na mão
- Módulo **Tarefas** (quadro A fazer/Fazendo/Feito, separado visualmente em manuais/administrativas x criativas, com prioridade e prazo)
- **Controle de Ponto**: botão de bater ponto (com cronômetro ao vivo) vinculado a categoria e/ou tarefa, totais de hoje e da semana, comparativo com a semana anterior (inclusive por categoria manual x criativa), e lista de tarefas concluídas na semana
- **Conquistas & Recompensas**: conquistas desbloqueadas automaticamente (streak de metas de conteúdo, mês de pagamentos 100% em dia) com sistema simples de pontos, e recompensas pessoais que você cadastra vinculadas aos seus próprios marcos
- **Dashboard consolidado**: aulas do dia, tarefas urgentes, pagamentos pendentes, contratos vencendo, meta de conteúdo da semana, financeiro do mês, horas trabalhadas (semana atual x anterior) e barra do limite MEI — tudo em uma tela só

Todas as 4 fases do plano original estão prontas. Próximos passos ficam a critério de ajustes e refinamentos sob demanda.

## Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Criar projeto no Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No SQL Editor, rode o conteúdo de `supabase/migrations/0001_init.sql` (ou use a CLI do Supabase: `supabase db push`).
3. Em **Authentication > Providers**, garanta que Email está habilitado. Se quiser usar apenas magic link, pode desabilitar "Confirm email" conforme sua preferência.
4. Crie seu usuário (você mesma) em **Authentication > Users** ou pelo próprio formulário de login do app.

### 3. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
```

- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`: em Supabase > Project Settings > API.
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`: mesma URL + a **service role key** (Project Settings > API). Usada só nas funções serverless em `/api`, nunca exposta no frontend.
- `ZOOM_ACCOUNT_ID` / `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET`: crie um app **Server-to-Server OAuth** em [marketplace.zoom.us](https://marketplace.zoom.us/) com o escopo `meeting:write:meeting` e `meeting:read:meeting` (admin). Copie as credenciais geradas.
- `ZOOM_USER_ID`: normalmente `me` (cria as reuniões no seu próprio calendário Zoom).
- `ZOOM_WEBHOOK_SECRET_TOKEN` (opcional, mas recomendado): em **Feature > Event Subscriptions** do seu app Zoom, adicione a URL `https://SEU-DOMINIO/api/zoom/webhook`, assine os eventos `Meeting Updated` e `Meeting Deleted`, e copie o "Secret Token" gerado.

### 4. Rodar localmente

```bash
npm run dev
```

As funções em `/api` (integração Zoom) são serverless e só funcionam de fato rodando com `vercel dev` (ou já no ambiente da Vercel). Para desenvolver só a UI, `npm run dev` (Vite) é suficiente — as chamadas a `/api/zoom/*` vão falhar localmente a menos que você use `vercel dev`.

### 5. Deploy na Vercel

1. Importe o repositório na Vercel.
2. Configure as mesmas variáveis de ambiente do `.env` em **Project Settings > Environment Variables**.
3. Deploy. O `vercel.json` já cuida do rewrite de SPA e as funções em `/api` são detectadas automaticamente.

### 6. Instalar como PWA

Acesse o app publicado pelo navegador do celular e use "Adicionar à tela inicial" (Android/Chrome) ou "Adicionar à Tela de Início" (iOS/Safari, no menu de compartilhar).

## Migração da planilha antiga

Os dados da planilha de controle de pagamentos/gastos (jan–jun/2026) já foram migrados para `supabase/seed/0001_seed_from_planilha.sql`, adaptados ao schema atual: 10 alunos em `students`, os pagamentos recebidos em `payments`, e as receitas/despesas do negócio em `transactions`.

**Passo a passo para rodar (sem precisar saber programar):**

1. Garanta que os passos 1–3 do Setup acima já foram feitos (projeto Supabase criado, migration `0001_init.sql` rodada).
2. Crie sua conta no app pelo menos uma vez (acesse a tela de login e cadastre seu e-mail/senha) — o script identifica automaticamente o único usuário existente no Supabase Auth.
3. No painel do Supabase, abra **SQL Editor** no menu lateral.
4. Clique em **New query**.
5. Abra o arquivo `supabase/seed/0001_seed_from_planilha.sql` deste repositório, copie todo o conteúdo e cole no editor.
6. Clique em **Run**. Se aparecer "Success. No rows returned", funcionou.
7. Pode rodar de novo sem medo — o script não duplica dados já existentes.

O que **não** foi migrado (a planilha não tinha esse detalhe): horário/data de cada aula individual (cadastre as aulas daqui pra frente pelo módulo Aulas), WhatsApp/e-mail/nível/objetivo de cada aluno (edite depois pela tela de Alunos), e 2 lançamentos que estavam marcados como "pendente" na planilha (Aura YouTube de janeiro e K.Education de abril) — ficaram de fora de propósito, para você lançar manualmente quando confirmar se foram pagos ou não. Todos os detalhes estão comentados no topo do próprio arquivo `.sql`.

## Estrutura

```
src/
  pages/         páginas por módulo (Alunos, Calendário, Pagamentos, ...)
  components/    componentes reutilizáveis (Layout, Modal, ...)
  contexts/      AuthContext
  lib/           clientes (supabase, zoomApi) e helpers de formatação
api/
  zoom/          funções serverless da integração com Zoom (S2S OAuth)
  _lib/          helpers compartilhados (auth, cliente Zoom, cliente admin do Supabase)
supabase/
  migrations/    schema do banco (SQL)
```
