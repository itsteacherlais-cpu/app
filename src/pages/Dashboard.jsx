import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatTime, formatDate, CLASS_STATUS } from '../lib/format'
import { differenceInCalendarDays, endOfDay, endOfWeek, startOfDay } from 'date-fns'
import { CalendarDays, AlertCircle, Video } from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuth()
  const [todayClasses, setTodayClasses] = useState([])
  const [weekClasses, setWeekClasses] = useState([])
  const [pendingPayments, setPendingPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const now = new Date()
    const [{ data: today }, { data: week }, { data: pending }] = await Promise.all([
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
    ])
    setTodayClasses(today || [])
    setWeekClasses(week || [])
    setPendingPayments(pending || [])
    setLoading(false)
  }

  const withOverdue = useMemo(() => {
    const now = new Date()
    return pendingPayments.map((p) => ({
      ...p,
      daysOverdue: p.due_date ? differenceInCalendarDays(now, new Date(p.due_date)) : null,
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
        </div>
      )}
    </div>
  )
}
