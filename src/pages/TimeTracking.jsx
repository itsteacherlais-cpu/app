import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Play, Square, Clock, ListChecks, Pencil, Trash2 } from 'lucide-react'
import { WORK_CATEGORY, formatHours, formatDateTime, formatStopwatch } from '../lib/format'
import { getPeriodRange } from '../lib/period'
import { differenceInMinutes, differenceInSeconds, subWeeks, startOfDay, endOfDay, format } from 'date-fns'

export default function TimeTracking() {
  const { user } = useAuth()
  const [activeSession, setActiveSession] = useState(null)
  const [sessions, setSessions] = useState([])
  const [allTasks, setAllTasks] = useState([])
  const [openTasks, setOpenTasks] = useState([])
  const [doneTasksThisWeek, setDoneTasksThisWeek] = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [category, setCategory] = useState('aulas')
  const [taskId, setTaskId] = useState('')
  const [, setTick] = useState(0)
  const [editingSession, setEditingSession] = useState(null)
  const [sessionForm, setSessionForm] = useState(null)
  const [savingSession, setSavingSession] = useState(false)

  useEffect(() => {
    load()
  }, [])

  // Recalcula o cronômetro ao vivo (com segundos) enquanto tem sessão ativa
  useEffect(() => {
    if (!activeSession) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [activeSession])

  async function load() {
    setLoading(true)
    const thisWeek = getPeriodRange('week')
    const lastWeek = getPeriodRange('week', subWeeks(new Date(), 1))

    const [{ data: active }, { data: recentSessions }, { data: tasks }] = await Promise.all([
      supabase.from('work_sessions').select('*').is('ended_at', null).maybeSingle(),
      supabase
        .from('work_sessions')
        .select('*')
        .gte('started_at', lastWeek.start.toISOString())
        .order('started_at', { ascending: false }),
      supabase.from('tasks').select('*').order('title'),
    ])

    setActiveSession(active || null)
    setSessions(recentSessions || [])
    setAllTasks(tasks || [])
    setOpenTasks((tasks || []).filter((t) => t.status !== 'done'))
    setDoneTasksThisWeek(
      (tasks || []).filter((t) => t.status === 'done' && new Date(t.updated_at) >= thisWeek.start)
    )
    setLoading(false)
  }

  async function handleStart(e) {
    e.preventDefault()
    if (activeSession) {
      toast.error('Você já tem uma sessão em andamento')
      return
    }
    setStarting(true)
    const { error } = await supabase.from('work_sessions').insert({
      user_id: user.id,
      category,
      task_id: taskId || null,
      started_at: new Date().toISOString(),
    })
    if (error) toast.error('Erro ao bater ponto')
    else {
      toast.success('Ponto iniciado')
      load()
    }
    setStarting(false)
  }

  async function handleEnd() {
    if (!activeSession) return
    const endedAt = new Date()
    const duration = Math.round(differenceInSeconds(endedAt, new Date(activeSession.started_at)) / 60)
    const { error } = await supabase
      .from('work_sessions')
      .update({ ended_at: endedAt.toISOString(), duration_minutes: duration })
      .eq('id', activeSession.id)
    if (error) toast.error('Erro ao encerrar ponto')
    else {
      toast.success(`Sessão encerrada: ${formatHours(duration)}`)
      load()
    }
  }

  function openEditSession(session) {
    const start = new Date(session.started_at)
    const end = session.ended_at ? new Date(session.ended_at) : null
    setEditingSession(session)
    setSessionForm({
      category: session.category || 'aulas',
      task_id: session.task_id || '',
      date: format(start, 'yyyy-MM-dd'),
      startTime: format(start, 'HH:mm'),
      endTime: end ? format(end, 'HH:mm') : '',
    })
  }

  async function handleSaveSession(e) {
    e.preventDefault()
    setSavingSession(true)
    const startedAt = new Date(`${sessionForm.date}T${sessionForm.startTime}:00`)
    const endedAt = sessionForm.endTime ? new Date(`${sessionForm.date}T${sessionForm.endTime}:00`) : null
    if (endedAt && endedAt <= startedAt) {
      toast.error('Horário de fim precisa ser depois do início')
      setSavingSession(false)
      return
    }
    const payload = {
      category: sessionForm.category,
      task_id: sessionForm.task_id || null,
      started_at: startedAt.toISOString(),
      ended_at: endedAt ? endedAt.toISOString() : null,
      duration_minutes: endedAt ? differenceInMinutes(endedAt, startedAt) : null,
    }
    const { error } = await supabase.from('work_sessions').update(payload).eq('id', editingSession.id)
    if (error) toast.error('Erro ao salvar sessão')
    else {
      toast.success('Sessão atualizada')
      setEditingSession(null)
      load()
    }
    setSavingSession(false)
  }

  async function handleDeleteSession(id) {
    if (!confirm('Excluir esta sessão de ponto?')) return
    const { error } = await supabase.from('work_sessions').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir')
    else {
      toast.success('Excluída')
      load()
    }
  }

  function effectiveMinutes(session) {
    if (session.duration_minutes != null) return session.duration_minutes
    if (!session.ended_at) return differenceInMinutes(new Date(), new Date(session.started_at))
    return differenceInMinutes(new Date(session.ended_at), new Date(session.started_at))
  }

  const stats = useMemo(() => {
    const now = new Date()
    const thisWeek = getPeriodRange('week', now)
    const lastWeek = getPeriodRange('week', subWeeks(now, 1))
    const todayStart = startOfDay(now)
    const todayEnd = endOfDay(now)

    function sumFor(start, end, group) {
      return sessions
        .filter((s) => {
          const startedAt = new Date(s.started_at)
          if (startedAt < start || startedAt > end) return false
          if (group && WORK_CATEGORY[s.category]?.group !== group) return false
          return true
        })
        .reduce((sum, s) => sum + effectiveMinutes(s), 0)
    }

    return {
      today: sumFor(todayStart, todayEnd),
      thisWeekTotal: sumFor(thisWeek.start, thisWeek.end),
      thisWeekManual: sumFor(thisWeek.start, thisWeek.end, 'manual'),
      thisWeekCriativa: sumFor(thisWeek.start, thisWeek.end, 'criativa'),
      lastWeekTotal: sumFor(lastWeek.start, lastWeek.end),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions])

  const weekDiff = stats.thisWeekTotal - stats.lastWeekTotal

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-5 text-xl font-semibold text-slate-900">Controle de Ponto</h1>

      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5 text-center">
        {activeSession ? (
          <>
            <p className="text-xs text-slate-400">
              Trabalhando em <strong className="text-slate-600">{WORK_CATEGORY[activeSession.category]?.label}</strong> desde{' '}
              {formatDateTime(activeSession.started_at)}
            </p>
            <p className="my-3 font-mono text-3xl font-semibold tabular-nums text-indigo-600">
              {formatStopwatch(differenceInSeconds(new Date(), new Date(activeSession.started_at)))}
            </p>
            <button
              onClick={handleEnd}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-700"
            >
              <Square className="h-4 w-4" /> Encerrar ponto
            </button>
          </>
        ) : (
          <form onSubmit={handleStart} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="input">
                {Object.entries(WORK_CATEGORY).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <select value={taskId} onChange={(e) => setTaskId(e.target.value)} className="input">
                <option value="">Sem tarefa vinculada</option>
                {openTasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={starting}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              <Play className="h-4 w-4" /> Bater ponto
            </button>
          </form>
        )}
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                <Clock className="h-3.5 w-3.5" /> Hoje
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{formatHours(stats.today)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                <Clock className="h-3.5 w-3.5" /> Esta semana
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{formatHours(stats.thisWeekTotal)}</p>
              <p className={`text-xs ${weekDiff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {weekDiff >= 0 ? '+' : ''}{formatHours(Math.abs(weekDiff))} vs. semana passada ({formatHours(stats.lastWeekTotal)})
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Esta semana por tipo de tarefa</h3>
            <div className="space-y-2">
              <CategoryBar label="Manual/administrativa" minutes={stats.thisWeekManual} total={stats.thisWeekTotal} tone="blue" />
              <CategoryBar label="Criativa" minutes={stats.thisWeekCriativa} total={stats.thisWeekTotal} tone="violet" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <ListChecks className="h-4 w-4 text-emerald-600" /> Tarefas concluídas esta semana
            </h3>
            {doneTasksThisWeek.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma tarefa concluída ainda esta semana.</p>
            ) : (
              <ul className="space-y-1.5">
                {doneTasksThisWeek.map((t) => (
                  <li key={t.id} className="text-sm text-slate-600">✓ {t.title}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-400">
              {stats.thisWeekTotal > 0 && doneTasksThisWeek.length > 0
                ? `${formatHours(Math.round(stats.thisWeekTotal / doneTasksThisWeek.length))} em média por tarefa concluída`
                : ''}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Sessões recentes</h3>
            {sessions.filter((s) => s.ended_at).length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma sessão encerrada ainda.</p>
            ) : (
              <div className="space-y-1.5">
                {sessions
                  .filter((s) => s.ended_at)
                  .map((s) => {
                    const task = allTasks.find((t) => t.id === s.task_id)
                    return (
                      <div key={s.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="text-slate-700">
                            {WORK_CATEGORY[s.category]?.label || s.category}
                            {task && <span className="text-slate-400"> · {task.title}</span>}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatDateTime(s.started_at)} – {format(new Date(s.ended_at), 'HH:mm')} ({formatHours(effectiveMinutes(s))})
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button onClick={() => openEditSession(s)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDeleteSession(s.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal open={!!editingSession} onClose={() => setEditingSession(null)} title="Editar sessão">
        {sessionForm && (
          <>
            <form id="session-form" onSubmit={handleSaveSession} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Categoria</span>
                <select
                  value={sessionForm.category}
                  onChange={(e) => setSessionForm({ ...sessionForm, category: e.target.value })}
                  className="input"
                >
                  {Object.entries(WORK_CATEGORY).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Tarefa vinculada</span>
                <select
                  value={sessionForm.task_id}
                  onChange={(e) => setSessionForm({ ...sessionForm, task_id: e.target.value })}
                  className="input"
                >
                  <option value="">Sem tarefa vinculada</option>
                  {allTasks.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Data</span>
                <input
                  type="date"
                  required
                  value={sessionForm.date}
                  onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })}
                  className="input"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Início</span>
                  <input
                    type="time"
                    required
                    value={sessionForm.startTime}
                    onChange={(e) => setSessionForm({ ...sessionForm, startTime: e.target.value })}
                    className="input"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Fim</span>
                  <input
                    type="time"
                    required
                    value={sessionForm.endTime}
                    onChange={(e) => setSessionForm({ ...sessionForm, endTime: e.target.value })}
                    className="input"
                  />
                </label>
              </div>
            </form>
            <div className="mt-2 flex gap-2 pt-2">
              <button
                type="submit"
                form="session-form"
                disabled={savingSession}
                className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {savingSession ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

function CategoryBar({ label, minutes, total, tone }) {
  const pct = total > 0 ? Math.round((minutes / total) * 100) : 0
  const tones = { blue: 'bg-blue-500', violet: 'bg-violet-500' }
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span>{formatHours(minutes)} ({pct}%)</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tones[tone]}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
