import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Play, Square, Clock, ListChecks } from 'lucide-react'
import { WORK_CATEGORY, formatHours, formatDateTime } from '../lib/format'
import { getPeriodRange } from '../lib/period'
import { differenceInMinutes, subWeeks, startOfDay, endOfDay } from 'date-fns'

export default function TimeTracking() {
  const { user } = useAuth()
  const [activeSession, setActiveSession] = useState(null)
  const [sessions, setSessions] = useState([])
  const [openTasks, setOpenTasks] = useState([])
  const [doneTasksThisWeek, setDoneTasksThisWeek] = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [category, setCategory] = useState('aulas')
  const [taskId, setTaskId] = useState('')
  const [, setTick] = useState(0)

  useEffect(() => {
    load()
  }, [])

  // Recalcula o cronômetro ao vivo enquanto tem sessão ativa
  useEffect(() => {
    if (!activeSession) return
    const id = setInterval(() => setTick((t) => t + 1), 30000)
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
    const duration = differenceInMinutes(endedAt, new Date(activeSession.started_at))
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
            <p className="my-3 text-3xl font-semibold text-indigo-600">
              {formatHours(differenceInMinutes(new Date(), new Date(activeSession.started_at)))}
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
        </div>
      )}
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
