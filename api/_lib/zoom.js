// Integração com Zoom via Server-to-Server OAuth App.
// Docs: https://developers.zoom.us/docs/internal-apps/s2s-oauth/

let cachedToken = null
let cachedTokenExpiresAt = 0

async function getAccessToken() {
  const now = Date.now()
  if (cachedToken && now < cachedTokenExpiresAt - 60_000) {
    return cachedToken
  }

  const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET } = process.env
  if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
    throw new Error('Variáveis do Zoom não configuradas (ZOOM_ACCOUNT_ID/ZOOM_CLIENT_ID/ZOOM_CLIENT_SECRET)')
  }

  const basicAuth = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64')
  const resp = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`,
    {
      method: 'POST',
      headers: { Authorization: `Basic ${basicAuth}` },
    }
  )

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Falha ao obter token do Zoom: ${resp.status} ${text}`)
  }

  const data = await resp.json()
  cachedToken = data.access_token
  cachedTokenExpiresAt = now + data.expires_in * 1000
  return cachedToken
}

export async function zoomRequest(path, options = {}) {
  const token = await getAccessToken()
  const resp = await fetch(`https://api.zoom.us/v2${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  return resp
}

export async function createZoomMeeting({ topic, startTime, durationMinutes, agenda }) {
  const userId = process.env.ZOOM_USER_ID || 'me'
  const resp = await zoomRequest(`/users/${userId}/meetings`, {
    method: 'POST',
    body: JSON.stringify({
      topic,
      type: 2, // scheduled meeting
      start_time: startTime, // ISO 8601 UTC
      duration: durationMinutes,
      agenda,
      timezone: 'UTC',
      settings: {
        join_before_host: true,
        waiting_room: false,
        approval_type: 2,
      },
    }),
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Falha ao criar reunião no Zoom: ${resp.status} ${text}`)
  }
  return resp.json()
}

export async function updateZoomMeeting(meetingId, { topic, startTime, durationMinutes, agenda }) {
  const body = {}
  if (topic !== undefined) body.topic = topic
  if (startTime !== undefined) body.start_time = startTime
  if (durationMinutes !== undefined) body.duration = durationMinutes
  if (agenda !== undefined) body.agenda = agenda
  if (startTime !== undefined) body.timezone = 'UTC'

  const resp = await zoomRequest(`/meetings/${meetingId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  if (!resp.ok && resp.status !== 204) {
    const text = await resp.text()
    throw new Error(`Falha ao atualizar reunião no Zoom: ${resp.status} ${text}`)
  }
}

export async function deleteZoomMeeting(meetingId) {
  const resp = await zoomRequest(`/meetings/${meetingId}`, { method: 'DELETE' })
  if (!resp.ok && resp.status !== 204 && resp.status !== 404) {
    const text = await resp.text()
    throw new Error(`Falha ao cancelar reunião no Zoom: ${resp.status} ${text}`)
  }
}

export async function getZoomMeeting(meetingId) {
  const resp = await zoomRequest(`/meetings/${meetingId}`, { method: 'GET' })
  if (resp.status === 404) return null
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`Falha ao consultar reunião no Zoom: ${resp.status} ${text}`)
  }
  return resp.json()
}
