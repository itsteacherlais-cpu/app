import { requireAuth } from '../../_lib/auth.js'
import { createZoomMeeting } from '../../_lib/zoom.js'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin.js'

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' })
    return
  }

  const { classId, topic, startTime, durationMinutes, agenda } = req.body || {}
  if (!classId || !topic || !startTime || !durationMinutes) {
    res.status(400).json({ error: 'classId, topic, startTime e durationMinutes são obrigatórios' })
    return
  }

  const supabase = getSupabaseAdmin()
  // Garante que a aula pertence ao usuário autenticado antes de criar a reunião.
  const { data: classRow, error: classError } = await supabase
    .from('classes')
    .select('id, user_id')
    .eq('id', classId)
    .single()

  if (classError || !classRow || classRow.user_id !== req.user.id) {
    res.status(404).json({ error: 'Aula não encontrada' })
    return
  }

  try {
    const meeting = await createZoomMeeting({ topic, startTime, durationMinutes, agenda })

    const { error: updateError } = await supabase
      .from('classes')
      .update({
        zoom_meeting_id: String(meeting.id),
        zoom_join_url: meeting.join_url,
        zoom_start_url: meeting.start_url,
        zoom_sync_status: 'synced',
        zoom_last_synced_at: new Date().toISOString(),
      })
      .eq('id', classId)

    if (updateError) throw updateError

    res.status(200).json({
      meetingId: meeting.id,
      joinUrl: meeting.join_url,
      startUrl: meeting.start_url,
    })
  } catch (err) {
    await supabase.from('classes').update({ zoom_sync_status: 'error' }).eq('id', classId)
    res.status(502).json({ error: err.message })
  }
})
