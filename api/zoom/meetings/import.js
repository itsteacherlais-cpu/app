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

  const { meetingId, studentId } = req.body || {}
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
    const meeting = await getZoomMeeting(meetingId)
    if (!meeting) {
      res.status(404).json({ error: 'Reunião não encontrada no Zoom' })
      return
    }

    const { data: created, error: insertError } = await supabase
      .from('classes')
      .insert({
        user_id: req.user.id,
        student_id: studentId,
        scheduled_at: meeting.start_time,
        duration_minutes: meeting.duration,
        status: 'scheduled',
        zoom_meeting_id: String(meeting.id),
        zoom_join_url: meeting.join_url,
        zoom_start_url: meeting.start_url,
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
