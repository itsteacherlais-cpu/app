-- Campos adicionais capturados do contrato (importação automática por PDF).
alter table students add column address text;
alter table students add column cep text;
alter table students add column cpf text;
alter table students add column rg text;
alter table students add column birth_date date;
