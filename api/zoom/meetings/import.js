import { requireAuth } from '../../_lib/auth.js'
import { getZoomMeeting } from '../../_lib/zoom.js'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin.js'

// Importa uma reunião já existente no Zoom (ex.: agendada via Calendly) como
// uma aula dentro do app, vinculada ao aluno escolhido.
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' })
    return
  }

  const { meetingId, studentId, startTime, durationMinutes, joinUrl } = req.body || {}
  if (!meetingId || !studentId) {
    res.status(400).json({ error: 'meetingId e studentId são obrigatórios' })
    return
  }

  const supabase = getSupabaseAdmin()

  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id, user_id')
    .eq('id', studentId)
    .single()
  if (studentError || !student || student.user_id !== req.user.id) {
    res.status(404).json({ error: 'Aluno não encontrado' })
    return
  }

  try {
    // Reuniões recorrentes (ex.: aula fixa toda segunda) compartilham o mesmo
    // ID no Zoom entre as ocorrências — a consulta direta a uma reunião
    // (getZoomMeeting) só devolve o horário "base" da série, não da ocorrência
    // específica escolhida na lista. Por isso priorizamos o horário que já
    // veio da listagem (correto pra cada ocorrência) e só usamos o resultado
    // do getZoomMeeting pra completar dados que faltarem.
    const meeting = await getZoomMeeting(meetingId).catch(() => null)

    const resolvedStartTime = startTime || meeting?.start_time
    const resolvedDuration = durationMinutes || meeting?.duration
    const resolvedJoinUrl = joinUrl || meeting?.join_url || null

    if (!resolvedStartTime || !resolvedDuration) {
      res.status(422).json({
        error:
          'Não conseguimos identificar o horário exato dessa reunião no Zoom (comum em reuniões recorrentes sem horário fixo). Tenta atualizar a lista e importar de novo, ou cadastre essa aula manualmente em "Nova aula".',
      })
      return
    }

    const { data: created, error: insertError } = await supabase
      .from('classes')
      .insert({
        user_id: req.user.id,
        student_id: studentId,
        scheduled_at: resolvedStartTime,
        duration_minutes: resolvedDuration,
        status: 'scheduled',
        zoom_meeting_id: String(meetingId),
        zoom_join_url: resolvedJoinUrl,
        zoom_start_url: meeting?.start_url || null,
        zoom_sync_status: 'synced',
        zoom_last_synced_at: new Date().toISOString(),
      })
      .select('*, students(id, name, rate_value, rate_type)')
      .single()
    if (insertError) throw insertError

    res.status(200).json({ class: created })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})
