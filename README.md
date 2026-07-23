# Teacher Laís HQ

App de gestão do negócio da Teacher Laís (aulas particulares, conteúdo, infoproduto e finanças).

**Stack:** React + Tailwind CSS + Supabase (Postgres/Auth/Storage) + Vercel + PWA.

## Status do projeto

Este projeto está sendo construído em fases. **Fase 1 concluída:**

- Estrutura do app (React + Tailwind v4 + PWA instalável)
- Autenticação (e-mail/senha ou link mágico via Supabase Auth)
- Schema completo do banco (todas as fases já modeladas, com RLS)
- Módulo **Alunos** (cadastro, edição, busca)
- Módulo **Aulas/Calendário** (visão semana/mês, aulas avulsas ou recorrentes, integração com Zoom)
- Módulo **Pagamentos** (status por aula/pacote, marcação manual, alerta de atraso, resumo do mês)

Próximas fases: Conteúdo & Metas + Relatórios (Fase 2); Financeiro geral + limite MEI + Marketing/Infoproduto + Produção (Fase 3); Tarefas + Controle de Ponto + Gamificação + Dashboard consolidado (Fase 4).

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

Quando os arquivos de seed (SQL/CSV) da planilha de controle de pagamentos/gastos forem anexados, eles serão adaptados ao schema em `supabase/migrations/0001_init.sql` (tabelas `students`, `payments`, `transactions`) e disponibilizados em `supabase/seed/`.

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
