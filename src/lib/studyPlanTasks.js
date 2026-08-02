import { addDays, format } from 'date-fns'
import { supabase } from './supabase'

// Cria automaticamente uma tarefa "Atualizar study plan {aluno}" (criativa,
// prioridade alta, prazo pro dia seguinte) pra cada aula que já terminou e
// ainda não gerou essa tarefa. Roda uma vez por sessão (chamado do Layout),
// então funciona como um "catch up" de qualquer aula concluída desde a
// última vez que o app foi aberto.
export async function syncStudyPlanTasks(userId) {
  const { data: classes, error } = await supabase
    .from('classes')
    .select('id, scheduled_at, duration_minutes, students(name)')
    .eq('user_id', userId)
    .eq('study_plan_task_created', false)
    .neq('status', 'canceled')
    .lte('scheduled_at', new Date().toISOString())

  if (error || !classes || classes.length === 0) return

  const now = Date.now()
  const finished = classes.filter((c) => {
    const endsAt = new Date(c.scheduled_at).getTime() + (c.duration_minutes || 0) * 60000
    return endsAt <= now
  })

  for (const c of finished) {
    const studentName = c.students?.name || 'aluno'
    const dueDate = format(addDays(new Date(c.scheduled_at), 1), 'yyyy-MM-dd')

    const { error: taskError } = await supabase.from('tasks').insert({
      user_id: userId,
      title: `Atualizar study plan ${studentName}`,
      category: 'criativa',
      priority: 'alta',
      due_date: dueDate,
      status: 'todo',
    })

    if (!taskError) {
      await supabase.from('classes').update({ study_plan_task_created: true }).eq('id', c.id)
    }
  }
}
