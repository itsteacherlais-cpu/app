-- Permite selecionar mais de uma plataforma (YouTube/Instagram/TikTok/Outro)
-- por item de conteúdo, em vez de uma só.

alter table content_items add column platforms text[] not null default '{}';

update content_items
set platforms = array[platform]
where platform is not null;

alter table content_items drop column platform;

alter table content_items
  add constraint content_items_platforms_check
  check (platforms <@ array['youtube', 'instagram', 'tiktok', 'outro']::text[]);
