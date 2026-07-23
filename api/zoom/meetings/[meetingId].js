import { requireAuth } from '../../_lib/auth.js'
import { updateZoomMeeting, deleteZoomMeeting, getZoomMeeting } from '../../_lib/zoom.js'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin.js'

async function loadOwnedClassByMeeting(supabase, meetingId, userId) {
  const { data } = await supabase
    .from('classes')
    .select('id, user_id, zoom_meeting_id')
    .eq('zoom_meeting_id', meetingId)
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

export default requireAuth(async function handler(req, res) {
  const { meetingId } = req.query
  const supabase = getSupabaseAdmin()

  const classRow = await loadOwnedClassByMeeting(supabase, meetingId, req.user.id)
  if (!classRow) {
    res.status(404).json({ error: 'Reunião não encontrada para este usuário' })
    return
  }

  try {
    if (req.method === 'PATCH') {
      const { topic, startTime, durationMinutes, agenda } = req.body || {}
      await updateZoomMeeting(meetingId, { topic, startTime, durationMinutes, agenda })
      await supabase
        .from('classes')
        .update({ zoom_sync_status: 'synced', zoom_last_synced_at: new Date().toISOString() })
        .eq('id', classRow.id)
      res.status(200).json({ ok: true })
      return
    }

    if (req.method === 'DELETE') {
      await deleteZoomMeeting(meetingId)
      await supabase
        .from('classes')
        .update({
          zoom_meeting_id: null,
          zoom_join_url: null,
          zoom_start_url: null,
          zoom_sync_status: 'not_synced',
          zoom_last_synced_at: new Date().toISOString(),
        })
        .eq('id', classRow.id)
      res.status(200).json({ ok: true })
      return
    }

    if (req.method === 'GET') {
      const meeting = await getZoomMeeting(meetingId)
      if (!meeting) {
        await supabase
          .from('classes')
          .update({ zoom_sync_status: 'error', zoom_last_synced_at: new Date().toISOString() })
          .eq('id', classRow.id)
        res.status(200).json({ exists: false })
        return
      }
      await supabase
        .from('classes')
        .update({
          zoom_join_url: meeting.join_url,
          zoom_sync_status: 'synced',
          zoom_last_synced_at: new Date().toISOString(),
          scheduled_at: meeting.start_time,
          duration_minutes: meeting.duration,
        })
        .eq('id', classRow.id)
      res.status(200).json({ exists: true, meeting })
      return
    }

    res.status(405).json({ error: 'Método não permitido' })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})
