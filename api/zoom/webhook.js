import crypto from 'node:crypto'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'

export const config = {
  api: { bodyParser: false },
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

// Recebe eventos do Zoom (meeting.updated, meeting.deleted, meeting.started, meeting.ended)
// para refletir no sistema alterações feitas diretamente no Zoom.
// Configure esta URL em: Zoom App (Server-to-Server OAuth) > Feature > Event Subscriptions.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' })
    return
  }

  const secretToken = process.env.ZOOM_WEBHOOK_SECRET_TOKEN
  const rawBody = await readRawBody(req)
  const payload = JSON.parse(rawBody || '{}')

  // Handshake de validação da URL do webhook
  if (payload.event === 'endpoint.url_validation') {
    const plainToken = payload.payload?.plainToken
    const encryptedToken = crypto
      .createHmac('sha256', secretToken || '')
      .update(plainToken)
      .digest('hex')
    res.status(200).json({ plainToken, encryptedToken })
    return
  }

  // Verifica assinatura da requisição
  if (secretToken) {
    const timestamp = req.headers['x-zm-request-timestamp']
    const signature = req.headers['x-zm-signature']
    const message = `v0:${timestamp}:${rawBody}`
    const hash = crypto.createHmac('sha256', secretToken).update(message).digest('hex')
    const expected = `v0=${hash}`
    if (signature !== expected) {
      res.status(401).json({ error: 'Assinatura inválida' })
      return
    }
  }

  const meetingId = payload.payload?.object?.id ? String(payload.payload.object.id) : null
  if (!meetingId) {
    res.status(200).json({ ok: true })
    return
  }

  const supabase = getSupabaseAdmin()

  if (payload.event === 'meeting.deleted') {
    await supabase
      .from('classes')
      .update({ zoom_sync_status: 'error', zoom_last_synced_at: new Date().toISOString() })
      .eq('zoom_meeting_id', meetingId)
  } else if (payload.event === 'meeting.updated') {
    const obj = payload.payload.object
    const update = { zoom_sync_status: 'synced', zoom_last_synced_at: new Date().toISOString() }
    if (obj.start_time) update.scheduled_at = obj.start_time
    if (obj.duration) update.duration_minutes = obj.duration
    await supabase.from('classes').update(update).eq('zoom_meeting_id', meetingId)
  }

  res.status(200).json({ ok: true })
}
