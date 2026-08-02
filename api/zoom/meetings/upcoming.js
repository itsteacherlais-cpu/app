import { requireAuth } from '../../_lib/auth.js'
import { listUpcomingZoomMeetings } from '../../_lib/zoom.js'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin.js'

// Lista as próximas reuniões marcadas no Zoom (ex.: agendadas pelo Calendly)
// que ainda não foram vinculadas a nenhuma aula dentro do app.
//
// Reuniões recorrentes (ex.: aula fixa toda segunda) reaparecem na listagem
// do Zoom uma vez por ocorrência futura, mas todas com o MESMO id de
// reunião — só o horário muda. Por isso a comparação pra saber se já foi
// importada usa id + horário, não só o id (senão, ao importar uma semana,
// as próximas sumiriam da lista sem terem sido importadas).
export default requireAuth(async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método não permitido' })
    return
  }

  const supabase = getSupabaseAdmin()

  try {
    const meetings = await listUpcomingZoomMeetings()

    const { data: linked, error: linkedError } = await supabase
      .from('classes')
      .select('zoom_meeting_id, scheduled_at')
      .eq('user_id', req.user.id)
      .not('zoom_meeting_id', 'is', null)
    if (linkedError) throw linkedError

    const linkedKeys = new Set(
      (linked || []).map((c) => `${c.zoom_meeting_id}::${new Date(c.scheduled_at).getTime()}`)
    )
    const importable = meetings
      .filter((m) => !linkedKeys.has(`${m.id}::${new Date(m.start_time).getTime()}`))
      .map((m) => ({
        id: m.id,
        topic: m.topic,
        startTime: m.start_time,
        durationMinutes: m.duration,
        joinUrl: m.join_url,
      }))

    res.status(200).json({ meetings: importable })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})
