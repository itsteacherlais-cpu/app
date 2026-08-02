-- Link da pasta do aluno (Drive, etc.), editável na tela de Alunos.
alter table students add column folder_url text;

-- Marca se já foi criada a tarefa automática de "atualizar study plan"
-- depois que uma aula termina, pra não criar duplicada. Aulas que já
-- aconteceram antes dessa atualização ficam marcadas como já tratadas,
-- pra não gerar uma enxurrada de tarefas retroativas.
alter table classes add column study_plan_task_created boolean not null default false;
update classes set study_plan_task_created = true where scheduled_at < now();
