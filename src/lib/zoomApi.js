import { supabase } from './supabase'

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function createZoomMeetingForClass({ classId, topic, startTime, durationMinutes, agenda }) {
  const resp = await fetch('/api/zoom/meetings', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ classId, topic, startTime, durationMinutes, agenda }),
  })
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    throw new Error(body.error || 'Erro ao criar reunião no Zoom')
  }
  return resp.json()
}

export async function updateZoomMeeting(meetingId, { topic, startTime, durationMinutes, agenda }) {
  const resp = await fetch(`/api/zoom/meetings/${meetingId}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify({ topic, startTime, durationMinutes, agenda }),
  })
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    throw new Error(body.error || 'Erro ao atualizar reunião no Zoom')
  }
  return resp.json()
}

export async function deleteZoomMeeting(meetingId) {
  const resp = await fetch(`/api/zoom/meetings/${meetingId}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  })
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    throw new Error(body.error || 'Erro ao cancelar reunião no Zoom')
  }
  return resp.json()
}

export async function syncZoomMeeting(meetingId) {
  const resp = await fetch(`/api/zoom/meetings/${meetingId}`, {
    method: 'GET',
    headers: await authHeaders(),
  })
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    throw new Error(body.error || 'Erro ao sincronizar com o Zoom')
  }
  return resp.json()
}

export async function listImportableZoomMeetings() {
  const resp = await fetch('/api/zoom/meetings/upcoming', {
    method: 'GET',
    headers: await authHeaders(),
  })
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    throw new Error(body.error || 'Erro ao buscar reuniões do Zoom')
  }
  return resp.json()
}

export async function importZoomMeeting({ meetingId, studentId }) {
  const resp = await fetch('/api/zoom/meetings/import', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ meetingId, studentId }),
  })
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    throw new Error(body.error || 'Erro ao importar reunião do Zoom')
  }
  return resp.json()
}
