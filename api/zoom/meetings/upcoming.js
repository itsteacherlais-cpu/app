import { requireAuth } from '../../_lib/auth.js'
import { listUpcomingZoomMeetings } from '../../_lib/zoom.js'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin.js'

// Lista as próximas reuniões marcadas no Zoom (ex.: agendadas pelo Calendly)
// que ainda não foram vinculadas a nenhuma aula dentro do app.
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
      .select('zoom_meeting_id')
      .eq('user_id', req.user.id)
      .not('zoom_meeting_id', 'is', null)
    if (linkedError) throw linkedError

    const linkedIds = new Set((linked || []).map((c) => String(c.zoom_meeting_id)))
    const importable = meetings
      .filter((m) => !linkedIds.has(String(m.id)))
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
