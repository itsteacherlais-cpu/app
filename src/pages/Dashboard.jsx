import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatTime, formatDate, formatHours, CLASS_STATUS, TASK_PRIORITY } from '../lib/format'
import { getPeriodRange } from '../lib/period'
import {
  differenceInCalendarDays, differenceInMinutes, endOfDay, endOfWeek, startOfDay, startOfMonth, endOfMonth,
  startOfYear, subWeeks, addDays, format, parseISO,
} from 'date-fns'
import {
  CalendarDays, AlertCircle, Video, Clapperboard, FileText, ListTodo, Timer, Landmark, Gauge,
  Sparkles, RefreshCw, Plus, Check,
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function Dashboard() {
  const { user } = useAuth()
  const [todayClasses, setTodayClasses] = useState([])
  const [weekClasses, setWeekClasses] = useState([])
  const [pendingPayments, setPendingPayments] = useState([])
  const [expiringContracts, setExpiringContracts] = useState([])
  const [contentGoal, setContentGoal] = useState(null)
  const [contentProduced, setContentProduced] = useState(0)
  const [urgentTasks, setUrgentTasks] = useState([])
  const [hoursStats, setHoursStats] = useState({ thisWeek: 0, lastWeek: 0 })
  const [monthFinance, setMonthFinance] = useState({ income: 0, expense: 0 })
  const [mei, setMei] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const now = new Date()
    const todayStr = format(now, 'yyyy-MM-dd')
    const thisWeek = getPeriodRange('week', now)
    const lastWeek = getPeriodRange('week', subWeeks(now, 1))

    const [
      { data: today }, { data: week }, { data: pending }, { data: contracts }, { data: goals },
      { data: tasks }, { data: workSessions }, { data: transactions }, { data: settings },
    ] = await Promise.all([
      supabase
        .from('classes')
        .select('*, students(name)')
        .gte('scheduled_at', startOfDay(now).toISOString())
        .lte('scheduled_at', endOfDay(now).toISOString())
        .neq('status', 'canceled')
        .order('scheduled_at'),
      supabase
        .from('classes')
        .select('*, students(name)')
        .gte('scheduled_at', startOfDay(now).toISOString())
        .lte('scheduled_at', endOfWeek(now, { weekStartsOn: 1 }).toISOString())
        .neq('status', 'canceled')
        .order('scheduled_at'),
      supabase
        .from('payments')
        .select('*, students(name)')
        .neq('status', 'paid')
        .order('due_date', { ascending: true, nullsFirst: false }),
      supabase
        .from('contracts')
        .select('*, students(name)')
        .gte('end_date', format(now, 'yyyy-MM-dd'))
        .lte('end_date', format(addDays(now, 30), 'yyyy-MM-dd'))
        .order('end_date', { ascending: true }),
      supabase
        .from('content_goals')
        .select('*')
        .eq('period_type', 'week')
        .order('period_start', { ascending: false })
        .limit(1),
      supabase
        .from('tasks')
        .select('*')
        .neq('status', 'done')
        .not('due_date', 'is', null)
        .lte('due_date', todayStr)
        .order('due_date', { ascending: true }),
      supabase
        .from('work_sessions')
        .select('*')
        .gte('started_at', lastWeek.start.toISOString()),
      supabase
        .from('transactions')
        .select('*')
        .gte('occurred_on', format(startOfYear(now), 'yyyy-MM-dd')),
      supabase.from('settings').select('*').maybeSingle(),
    ])
    setTodayClasses(today || [])
    setWeekClasses(week || [])
    setPendingPayments(pending || [])
    setExpiringContracts(contracts || [])
    setUrgentTasks(tasks || [])

    function effectiveMinutes(s) {
      if (s.duration_minutes != null) return s.duration_minutes
      const end = s.ended_at ? new Date(s.ended_at) : now
      return differenceInMinutes(end, new Date(s.started_at))
    }
    const sessions = workSessions || []
    setHoursStats({
      thisWeek: sessions
        .filter((s) => new Date(s.started_at) >= thisWeek.start && new Date(s.started_at) <= thisWeek.end)
        .reduce((sum, s) => sum + effectiveMinutes(s), 0),
      lastWeek: sessions
        .filter((s) => new Date(s.started_at) >= lastWeek.start && new Date(s.started_at) <= lastWeek.end)
        .reduce((sum, s) => sum + effectiveMinutes(s), 0),
    })

    const monthStartStr = format(startOfMonth(now), 'yyyy-MM-dd')
    const monthEndStr = format(endOfMonth(now), 'yyyy-MM-dd')
    const monthTx = (transactions || []).filter((t) => t.occurred_on >= monthStartStr && t.occurred_on <= monthEndStr)
    setMonthFinance({
      income: monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
      expense: monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
    })

    if (settings) {
      const yearIncome = (transactions || []).filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
      setMei({
        pct: Math.round((yearIncome / Number(settings.mei_annual_limit)) * 100),
        total: yearIncome,
        limit: Number(settings.mei_annual_limit),
      })
    }

    const goal = goals?.[0] || null
    setContentGoal(goal)
    if (goal) {
      const { count } = await supabase
        .from('content_items')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'published')
        .gte('published_date', goal.period_start)
        .lte('published_date', goal.period_end)
      setContentProduced(count || 0)
    }
    setLoading(false)
  }

  const withOverdue = useMemo(() => {
    const now = new Date()
    return pendingPayments.map((p) => ({
      ...p,
      daysOverdue: p.due_date ? differenceInCalendarDays(now, parseISO(p.due_date)) : null,
    }))
  }, [pendingPayments])

  const totalPending = pendingPayments.reduce((s, p) => s + Number(p.amount), 0)
  const firstName = user?.email?.split('@')[0]

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-semibold text-slate-900">Olá, {firstName} 👋</h1>
      <p className="mb-6 text-sm text-slate-500">Aqui está o resumo do seu dia</p>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
      ) : (
        <div className="space-y-5">
          <SuggestionsCard />

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <CalendarDays className="h-4 w-4 text-indigo-600" /> Aulas de hoje
              </h2>
              <Link to="/calendario" className="text-xs font-medium text-indigo-600 hover:underline">
                ver calendário
              </Link>
            </div>
            {todayClasses.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma aula hoje.</p>
            ) : (
              <div className="space-y-2">
                {todayClasses.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span>
                      <span className="font-medium text-slate-800">{formatTime(c.scheduled_at)}</span>{' '}
                      <span className="text-slate-600">{c.students?.name}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CLASS_STATUS[c.status].className}`}>
                        {CLASS_STATUS[c.status].label}
                      </span>
                      {c.zoom_join_url && (
                        <a href={c.zoom_join_url} target="_blank" rel="noreferrer" className="text-indigo-600">
                          <Video className="h-4 w-4" />
                        </a>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-slate-400">{weekClasses.length} aula(s) restantes esta semana</p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <ListTodo className="h-4 w-4 text-blue-600" /> Tarefas urgentes
              </h2>
              <Link to="/tarefas" className="text-xs font-medium text-indigo-600 hover:underline">
                ver todas
              </Link>
            </div>
            {urgentTasks.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma tarefa atrasada ou pra hoje 🎉</p>
            ) : (
              <div className="space-y-2">
                {urgentTasks.map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="text-slate-700">{t.title}</span>
                    <span className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TASK_PRIORITY[t.priority].className}`}>
                        {TASK_PRIORITY[t.priority].label}
                      </span>
                      <span className="text-[11px] text-red-600">{formatDate(t.due_date)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <AlertCircle className="h-4 w-4 text-amber-600" /> Pagamentos pendentes
              </h2>
              <Link to="/pagamentos" className="text-xs font-medium text-indigo-600 hover:underline">
                ver todos
              </Link>
            </div>
            {withOverdue.length === 0 ? (
              <p className="text-sm text-slate-400">Tudo em dia por aqui 🎉</p>
            ) : (
              <>
                <p className="mb-2 text-sm text-slate-600">
                  Total pendente: <span className="font-semibold text-slate-900">{formatCurrency(totalPending)}</span>
                </p>
                <div className="space-y-2">
                  {withOverdue.slice(0, 5).map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="text-slate-700">{p.students?.name}</span>
                      <span className="flex items-center gap-2">
                        <span>{formatCurrency(p.amount)}</span>
                        {p.due_date && (
                          <span className={`text-[11px] ${p.daysOverdue > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                            {p.daysOverdue > 0 ? `${p.daysOverdue}d atraso` : `vence ${formatDate(p.due_date)}`}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <FileText className="h-4 w-4 text-rose-600" /> Contratos vencendo
              </h2>
              <Link to="/alunos" className="text-xs font-medium text-indigo-600 hover:underline">
                ver contratos
              </Link>
            </div>
            {expiringContracts.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum contrato vencendo nos próximos 30 dias.</p>
            ) : (
              <div className="space-y-2">
                {expiringContracts.map((c) => {
                  const daysLeft = differenceInCalendarDays(parseISO(c.end_date), new Date())
                  return (
                    <div key={c.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span className="text-slate-700">
                        Contrato de <strong>{c.students?.name}</strong> vence
                      </span>
                      <span className="text-[11px] font-medium text-rose-600">
                        {daysLeft <= 0 ? 'hoje' : `em ${daysLeft}d`} ({formatDate(c.end_date)})
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Clapperboard className="h-4 w-4 text-violet-600" /> Meta de conteúdo da semana
              </h2>
              <Link to="/conteudo" className="text-xs font-medium text-indigo-600 hover:underline">
                ver quadro
              </Link>
            </div>
            {!contentGoal ? (
              <p className="text-sm text-slate-400">Nenhuma meta definida ainda.</p>
            ) : (
              <>
                <p className="text-sm text-slate-700">
                  <span className="text-lg font-semibold text-slate-900">{contentProduced}</span> / {contentGoal.target_count} publicados
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${
                      contentProduced >= contentGoal.target_count ? 'bg-emerald-500' : 'bg-indigo-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.round((contentProduced / contentGoal.target_count) * 100))}%` }}
                  />
                </div>
              </>
            )}
          </section>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Landmark className="h-4 w-4 text-emerald-600" /> Financeiro do mês
                </h2>
                <Link to="/financeiro" className="text-xs font-medium text-indigo-600 hover:underline">
                  ver tudo
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Receita</p>
                  <p className="font-semibold text-emerald-600">{formatCurrency(monthFinance.income)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Despesa</p>
                  <p className="font-semibold text-red-600">{formatCurrency(monthFinance.expense)}</p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Timer className="h-4 w-4 text-indigo-600" /> Horas trabalhadas
                </h2>
                <Link to="/ponto" className="text-xs font-medium text-indigo-600 hover:underline">
                  ver detalhes
                </Link>
              </div>
              <p className="text-sm text-slate-700">
                <span className="text-lg font-semibold text-slate-900">{formatHours(hoursStats.thisWeek)}</span> esta semana
              </p>
              <p className="text-xs text-slate-400">
                {hoursStats.thisWeek - hoursStats.lastWeek >= 0 ? '+' : ''}
                {formatHours(Math.abs(hoursStats.thisWeek - hoursStats.lastWeek))} vs. semana passada ({formatHours(hoursStats.lastWeek)})
              </p>
            </section>
          </div>

          {mei && (
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Gauge className="h-4 w-4 text-amber-600" /> Limite MEI {new Date().getFullYear()}
                </h2>
                <Link to="/financeiro" className="text-xs font-medium text-indigo-600 hover:underline">
                  ver detalhes
                </Link>
              </div>
              <p className="text-sm text-slate-700">
                {formatCurrency(mei.total)} de {formatCurrency(mei.limit)} ({mei.pct}%)
              </p>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${mei.pct >= 95 ? 'bg-red-500' : mei.pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, mei.pct)}%` }}
                />
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function SuggestionsCard() {
  const { user } = useAuth()
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState(null)
  const [addedIdx, setAddedIdx] = useState(new Set())

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('daily_suggestions')
      .select('items')
      .eq('suggestion_date', todayStr)
      .maybeSingle()
    if (data) {
      setItems(data.items)
      setLoading(false)
    } else {
      await generate(todayStr, false)
    }
  }

  async function generate(dateStr, force) {
    if (force) setRegenerating(true)
    setError(null)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const resp = await fetch('/api/suggestions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ date: dateStr, force }),
      })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(body.error || 'Erro ao gerar sugestões')
      }
      const body = await resp.json()
      setItems(body.items)
      setAddedIdx(new Set())
    } catch (err) {
      setError(err.message || 'Erro ao gerar sugestões')
    } finally {
      setLoading(false)
      setRegenerating(false)
    }
  }

  async function addToContent(item, idx) {
    const { error: insertError } = await supabase.from('content_items').insert({
      user_id: user.id,
      title: item.topic,
      notes: item.idea,
      format: 'short',
      platforms: [],
      status: 'idea',
    })
    if (insertError) toast.error('Erro ao adicionar ao quadro de Conteúdo')
    else {
      toast.success('Adicionado ao quadro de Conteúdo')
      setAddedIdx((prev) => new Set(prev).add(idx))
    }
  }

  return (
    <section className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Sparkles className="h-4 w-4 text-violet-600" /> Sugestões de hoje
        </h2>
        <button
          onClick={() => generate(format(new Date(), 'yyyy-MM-dd'), true)}
          disabled={loading || regenerating}
          title="Gerar novas sugestões"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-white disabled:opacity-40"
        >
          <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Buscando fofocas em alta e gerando ideias…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !items || items.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhuma sugestão disponível agora.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="rounded-lg bg-white/70 px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{item.topic}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.idea}</p>
                </div>
                <button
                  onClick={() => addToContent(item, idx)}
                  disabled={addedIdx.has(idx)}
                  title="Adicionar ao quadro de Conteúdo"
                  className={`shrink-0 rounded-lg p-1.5 ${
                    addedIdx.has(idx) ? 'text-emerald-600' : 'text-violet-500 hover:bg-violet-100'
                  }`}
                >
                  {addedIdx.has(idx) ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-[11px] text-slate-400">
        Fofocas de famosas/filmes/séries/música em alta em sites dos EUA e Europa + ideia de conteúdo pra ensinar inglês com o assunto. Atualiza sozinho uma vez por dia.
      </p>
    </section>
  )
}
