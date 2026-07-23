import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, Wallet, AlertTriangle, Settings as SettingsIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCurrency, formatDate } from '../lib/format'
import { getYearRange, getLastMonths, monthKey } from '../lib/finance'
import { startOfMonth, endOfMonth, format, differenceInCalendarMonths } from 'date-fns'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

const EMPTY_FORM = {
  id: null,
  type: 'income',
  category: '',
  amount: '',
  description: '',
  occurred_on: format(new Date(), 'yyyy-MM-dd'),
}

export default function Finance() {
  const { user } = useAuth()
  const [tab, setTab] = useState('visao')
  const [yearTransactions, setYearTransactions] = useState([])
  const [chartTransactions, setChartTransactions] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'))
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [categoryOptions, setCategoryOptions] = useState([])

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const yearRange = getYearRange()
    const months = getLastMonths(6)

    const [{ data: yearData, error: yearErr }, { data: chartData }, { data: settingsData }] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .gte('occurred_on', format(yearRange.start, 'yyyy-MM-dd'))
        .lte('occurred_on', format(yearRange.end, 'yyyy-MM-dd')),
      supabase
        .from('transactions')
        .select('*')
        .gte('occurred_on', format(months[0].start, 'yyyy-MM-dd')),
      supabase.from('settings').select('*').maybeSingle(),
    ])

    if (yearErr) toast.error('Erro ao carregar financeiro')
    setYearTransactions(yearData || [])
    setChartTransactions(chartData || [])
    setSettings(settingsData)
    setCategoryOptions([...new Set((yearData || []).map((t) => t.category))].sort())
    setLoading(false)
  }

  function openNew() {
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(t) {
    setForm({ ...t, amount: String(t.amount) })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      user_id: user.id,
      type: form.type,
      category: form.category.trim(),
      amount: Number(form.amount),
      description: form.description.trim() || null,
      occurred_on: form.occurred_on,
    }
    let error
    if (form.id) {
      ;({ error } = await supabase.from('transactions').update(payload).eq('id', form.id))
    } else {
      ;({ error } = await supabase.from('transactions').insert(payload))
    }
    if (error) toast.error('Erro ao salvar lançamento')
    else {
      toast.success(form.id ? 'Atualizado' : 'Lançado')
      setShowModal(false)
      loadAll()
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Excluir este lançamento?')) return
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir')
    else {
      toast.success('Excluído')
      loadAll()
    }
  }

  const currentMonthRange = { start: startOfMonth(new Date()), end: endOfMonth(new Date()) }
  const monthTransactions = useMemo(
    () =>
      yearTransactions.filter(
        (t) => new Date(t.occurred_on) >= currentMonthRange.start && new Date(t.occurred_on) <= currentMonthRange.end
      ),
    [yearTransactions]
  )
  const monthIncome = monthTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const monthExpense = monthTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const monthBalance = monthIncome - monthExpense

  const yearIncomeTotal = yearTransactions.filter((t) => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)

  const chartData = useMemo(() => {
    const months = getLastMonths(6)
    return months.map((m) => {
      const income = chartTransactions
        .filter((t) => t.type === 'income' && monthKey(new Date(t.occurred_on)) === m.key)
        .reduce((s, t) => s + Number(t.amount), 0)
      const expense = chartTransactions
        .filter((t) => t.type === 'expense' && monthKey(new Date(t.occurred_on)) === m.key)
        .reduce((s, t) => s + Number(t.amount), 0)
      return { mes: m.label, Receita: income, Despesa: expense }
    })
  }, [chartTransactions])

  const filteredList = useMemo(
    () => yearTransactions.filter((t) => monthKey(new Date(t.occurred_on)) === monthFilter).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)),
    [yearTransactions, monthFilter]
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Financeiro</h1>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> Lançar
        </button>
      </div>

      <div className="mb-5 flex gap-1.5">
        {[
          ['visao', 'Visão geral'],
          ['lancamentos', 'Lançamentos'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${
              tab === key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
      ) : tab === 'visao' ? (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2">
            <SummaryCard icon={TrendingUp} label="Receita (mês)" value={formatCurrency(monthIncome)} tone="emerald" />
            <SummaryCard icon={TrendingDown} label="Despesa (mês)" value={formatCurrency(monthExpense)} tone="red" />
            <SummaryCard icon={Wallet} label="Saldo (mês)" value={formatCurrency(monthBalance)} tone={monthBalance >= 0 ? 'emerald' : 'red'} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">Evolução (últimos 6 meses)</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Area type="monotone" dataKey="Receita" stroke="#6366f1" fill="url(#colorReceita)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Despesa" stroke="#f43f5e" fill="transparent" strokeWidth={2} strokeDasharray="4 4" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {settings && <MeiCard settings={settings} yearIncomeTotal={yearIncomeTotal} />}
        </div>
      ) : (
        <div>
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="input mb-4 w-auto"
          />
          {filteredList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-400">
              Nenhum lançamento neste mês.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredList.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          t.type === 'income' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {t.category}
                      </span>
                      <span className="text-xs text-slate-400">{formatDate(t.occurred_on)}</span>
                    </div>
                    {t.description && <p className="mt-1 truncate text-xs text-slate-500">{t.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`text-sm font-semibold ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {t.type === 'income' ? '+' : '-'}
                      {formatCurrency(t.amount)}
                    </span>
                    <button onClick={() => openEdit(t)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={form.id ? 'Editar lançamento' : 'Novo lançamento'}>
        <form id="tx-form" onSubmit={handleSave} className="space-y-4">
          <div className="flex gap-1.5">
            {[
              ['income', 'Receita'],
              ['expense', 'Despesa'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setForm({ ...form, type: key })}
                className={`flex-1 rounded-lg py-2 text-sm font-medium ${
                  form.type === key
                    ? key === 'income'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-red-600 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <Field label="Categoria">
            <input
              required
              list="category-options"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input"
              placeholder="Aulas, Infoproduto, Equipamento…"
            />
            <datalist id="category-options">
              {categoryOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor">
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Data">
              <input
                type="date"
                required
                value={form.occurred_on}
                onChange={(e) => setForm({ ...form, occurred_on: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <Field label="Descrição (opcional)">
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input"
            />
          </Field>
        </form>
        <div className="mt-2 flex gap-2 pt-2">
          <button
            type="submit"
            form="tx-form"
            disabled={saving}
            className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

function MeiCard({ settings, yearIncomeTotal }) {
  const limit = Number(settings.mei_annual_limit)
  const tolerancePct = Number(settings.mei_tolerance_pct)
  const toleranceLimit = limit * (1 + tolerancePct / 100)
  const pct = Math.round((yearIncomeTotal / limit) * 100)
  const thresholds = settings.mei_alert_thresholds || [70, 85, 95]
  const highestCrossed = [...thresholds].sort((a, b) => b - a).find((t) => pct >= t)
  const remaining = Math.max(0, limit - yearIncomeTotal)

  const now = new Date()
  const monthsElapsed = differenceInCalendarMonths(now, new Date(now.getFullYear(), 0, 1)) + 1
  const avgMonthly = monthsElapsed > 0 ? yearIncomeTotal / monthsElapsed : 0
  let projection = null
  if (avgMonthly > 0 && yearIncomeTotal < limit) {
    const monthsToLimit = Math.ceil((limit - yearIncomeTotal) / avgMonthly)
    const projectedDate = new Date(now.getFullYear(), now.getMonth() + monthsToLimit, 1)
    projection = format(projectedDate, 'MMM/yyyy')
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Limite MEI {now.getFullYear()}</h3>
        <Link to="/configuracoes" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
          <SettingsIcon className="h-3.5 w-3.5" /> ajustar
        </Link>
      </div>

      {highestCrossed && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Você já faturou {pct}% do limite anual. {pct >= 95 && 'Está bem perto do teto — considere falar com um contador sobre migrar de categoria (MEI → ME).'}
          </span>
        </div>
      )}

      <p className="text-sm text-slate-700">
        <span className="text-lg font-semibold text-slate-900">{formatCurrency(yearIncomeTotal)}</span> de {formatCurrency(limit)} ({pct}%)
      </p>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${pct >= 95 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-500">
        <p>Ainda pode faturar: <span className="font-medium text-slate-700">{formatCurrency(remaining)}</span></p>
        <p>Com tolerância (+{tolerancePct}%): <span className="font-medium text-slate-700">{formatCurrency(toleranceLimit)}</span></p>
      </div>
      {projection && (
        <p className="mt-2 text-xs text-slate-400">
          No ritmo atual (média de {formatCurrency(avgMonthly)}/mês), o teto seria atingido em <strong>{projection}</strong>.
        </p>
      )}
    </div>
  )
}

function SummaryCard({ icon: Icon, label, value, tone }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
  }
  return (
    <div className={`rounded-xl p-3 ${tones[tone]}`}>
      <Icon className="h-4 w-4 opacity-70" />
      <p className="mt-1 text-[11px] font-medium opacity-80">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  )
}
