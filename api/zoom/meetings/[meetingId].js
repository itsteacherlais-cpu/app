import { requireAuth } from '../../_lib/auth.js'
import { updateZoomMeeting, deleteZoomMeeting, getZoomMeeting } from '../../_lib/zoom.js'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin.js'

// Reuniões recorrentes importadas do Zoom têm o mesmo zoom_meeting_id em
// várias aulas (uma por ocorrência semanal). Quando o classId da aula em
// questão é informado, ele resolve a ambiguidade; sem ele, cai pra pegar a
// primeira aula correspondente (mantém compatibilidade com chamadas antigas).
async function loadOwnedClassByMeeting(supabase, meetingId, userId, classId) {
  let query = supabase
    .from('classes')
    .select('id, user_id, zoom_meeting_id')
    .eq('zoom_meeting_id', meetingId)
    .eq('user_id', userId)

  if (classId) query = query.eq('id', classId)

  const { data } = await query.order('scheduled_at', { ascending: true }).limit(1).maybeSingle()
  return data
}

// Reuniões recorrentes ficam vinculadas a várias aulas com o mesmo
// zoom_meeting_id (uma por semana importada). Nesse caso, editar/cancelar/
// sincronizar UMA aula no app não pode mexer na reunião real do Zoom, senão
// cancelaria a série inteira (afetando as outras semanas de verdade na
// agenda dela) ou sobrescreveria a data certa da ocorrência com a data
// "base" da série.
async function countOtherClassesForMeeting(supabase, meetingId, userId, excludeClassId) {
  const { count } = await supabase
    .from('classes')
    .select('id', { count: 'exact', head: true })
    .eq('zoom_meeting_id', meetingId)
    .eq('user_id', userId)
    .neq('id', excludeClassId)
  return count || 0
}

export default requireAuth(async function handler(req, res) {
  const { meetingId, classId } = req.query
  const supabase = getSupabaseAdmin()

  const classRow = await loadOwnedClassByMeeting(supabase, meetingId, req.user.id, classId)
  if (!classRow) {
    res.status(404).json({ error: 'Reunião não encontrada para este usuário' })
    return
  }

  try {
    const otherClassesCount = await countOtherClassesForMeeting(supabase, meetingId, req.user.id, classRow.id)
    const isSharedRecurringMeeting = otherClassesCount > 0

    if (req.method === 'PATCH') {
      if (!isSharedRecurringMeeting) {
        const { topic, startTime, durationMinutes, agenda } = req.body || {}
        await updateZoomMeeting(meetingId, { topic, startTime, durationMinutes, agenda })
      }
      await supabase
        .from('classes')
        .update({ zoom_sync_status: 'synced', zoom_last_synced_at: new Date().toISOString() })
        .eq('id', classRow.id)
      res.status(200).json({ ok: true })
      return
    }

    if (req.method === 'DELETE') {
      if (!isSharedRecurringMeeting) {
        await deleteZoomMeeting(meetingId)
      }
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
      if (isSharedRecurringMeeting) {
        // Aula de série recorrente: já temos o horário certo dessa ocorrência
        // específica (veio da importação), então só confirma o status sem
        // sobrescrever nada com o horário "base" da série no Zoom.
        await supabase
          .from('classes')
          .update({ zoom_sync_status: 'synced', zoom_last_synced_at: new Date().toISOString() })
          .eq('id', classRow.id)
        res.status(200).json({ exists: true, recurring: true })
        return
      }

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
          ...(meeting.start_time ? { scheduled_at: meeting.start_time } : {}),
          ...(meeting.duration ? { duration_minutes: meeting.duration } : {}),
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
