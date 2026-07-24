import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Check, Pencil, Trash2, AlertTriangle, Sparkles } from 'lucide-react'
import { formatCurrency, formatDate, PAYMENT_STATUS } from '../lib/format'
import { dueDateInMonth } from '../lib/finance'
import { startOfMonth, endOfMonth, differenceInCalendarDays, format, parseISO } from 'date-fns'

const EMPTY_FORM = {
  id: null,
  student_id: '',
  amount: '',
  reference_month: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
  due_date: format(new Date(), 'yyyy-MM-dd'),
  status: 'pending',
  payment_method: '',
  notes: '',
}

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'late', label: 'Atrasados' },
  { key: 'paid', label: 'Pagos' },
]

export default function Payments() {
  const { user } = useAuth()
  const [payments, setPayments] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [genMonth, setGenMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    init()
  }, [])

  async function fetchData() {
    const [{ data: p, error: pErr }, { data: s }] = await Promise.all([
      supabase
        .from('payments')
        .select('*, students(id, name)')
        .order('due_date', { ascending: true, nullsFirst: false }),
      supabase.from('students').select('*').eq('status', 'active').order('name'),
    ])
    if (pErr) toast.error('Erro ao carregar pagamentos')
    return { payments: p || [], students: s || [] }
  }

  async function loadAll() {
    setLoading(true)
    const { payments: p, students: s } = await fetchData()
    setPayments(p)
    setStudents(s)
    setLoading(false)
  }

  // Ao abrir a tela, gera automaticamente os pagamentos pendentes do mês
  // atual pra cada aluno ativo que ainda não tem um lançamento nesse mês —
  // assim ela só precisa marcar como pago, sem cadastrar na mão.
  async function init() {
    setLoading(true)
    const { payments: p, students: s } = await fetchData()
    const currentMonthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const created = await generateMissing(currentMonthStart, p, s)
    if (created > 0) {
      const fresh = await fetchData()
      setPayments(fresh.payments)
      setStudents(fresh.students)
    } else {
      setPayments(p)
      setStudents(s)
    }
    setLoading(false)
  }

  async function generateMissing(monthStartStr, existingPayments, activeStudents) {
    const missing = activeStudents.filter(
      (st) => !existingPayments.some((pay) => pay.student_id === st.id && pay.reference_month === monthStartStr)
    )
    if (missing.length === 0) return 0
    const monthStart = new Date(`${monthStartStr}T00:00:00`)
    const rows = missing.map((st) => ({
      user_id: user.id,
      student_id: st.id,
      amount: st.rate_value,
      reference_month: monthStartStr,
      due_date: dueDateInMonth(monthStart, st.payment_due_day),
      status: 'pending',
    }))
    const { error } = await supabase.from('payments').insert(rows)
    if (error) {
      toast.error('Erro ao gerar pagamentos do mês')
      return 0
    }
    toast.success(`${rows.length} pagamento(s) do mês gerado(s) automaticamente`)
    return rows.length
  }

  async function handleGenerateMonth() {
    setGenerating(true)
    const monthStartStr = `${genMonth}-01`
    const { payments: p, students: s } = await fetchData()
    const created = await generateMissing(monthStartStr, p, s)
    if (created === 0) toast('Nenhum pagamento novo pra gerar nesse mês', { icon: 'ℹ️' })
    await loadAll()
    setGenerating(false)
  }

  const withEffectiveStatus = useMemo(() => {
    const today = new Date()
    return payments.map((p) => {
      const daysOverdue = p.due_date ? differenceInCalendarDays(today, parseISO(p.due_date)) : null
      const isOverdue = p.status !== 'paid' && daysOverdue !== null && daysOverdue > 0
      return { ...p, daysOverdue, isOverdue }
    })
  }, [payments])

  const filtered = useMemo(() => {
    if (filter === 'all') return withEffectiveStatus
    if (filter === 'late') return withEffectiveStatus.filter((p) => p.status === 'late' || p.isOverdue)
    return withEffectiveStatus.filter((p) => p.status === filter && !(filter === 'pending' && p.isOverdue))
  }, [withEffectiveStatus, filter])

  const monthSummary = useMemo(() => {
    // Comparação por string ("yyyy-MM-dd"), não por Date: reference_month/due_date
    // são colunas "date" puras do Postgres, então comparar como texto evita
    // qualquer problema de fuso horário na conversão pra Date.
    const monthStartStr = format(startOfMonth(new Date()), 'yyyy-MM-dd')
    const monthEndStr = format(endOfMonth(new Date()), 'yyyy-MM-dd')
    const inMonth = payments.filter((p) => {
      const ref = p.reference_month || p.due_date
      return ref && ref >= monthStartStr && ref <= monthEndStr
    })
    const recebido = inMonth.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0)
    const aReceber = inMonth.filter((p) => p.status !== 'paid').reduce((s, p) => s + Number(p.amount), 0)
    const inadimplentes = new Set(
      withEffectiveStatus.filter((p) => p.status === 'late' || p.isOverdue).map((p) => p.student_id)
    ).size
    return { recebido, aReceber, inadimplentes }
  }, [payments, withEffectiveStatus])

  function openNew() {
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(p) {
    setForm({
      id: p.id,
      student_id: p.student_id,
      amount: String(p.amount),
      reference_month: p.reference_month || '',
      due_date: p.due_date || '',
      status: p.status,
      payment_method: p.payment_method || '',
      notes: p.notes || '',
    })
    setShowModal(true)
  }

  function onStudentChange(studentId) {
    const s = students.find((st) => st.id === studentId)
    setForm((f) => ({ ...f, student_id: studentId, amount: s ? String(s.rate_value) : f.amount }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.student_id) {
      toast.error('Selecione um aluno')
      return
    }
    setSaving(true)
    const payload = {
      user_id: user.id,
      student_id: form.student_id,
      amount: Number(form.amount),
      reference_month: form.reference_month || null,
      due_date: form.due_date || null,
      status: form.status,
      payment_method: form.payment_method || null,
      notes: form.notes || null,
      paid_at: form.status === 'paid' ? new Date().toISOString() : null,
    }

    let error
    if (form.id) {
      ;({ error } = await supabase.from('payments').update(payload).eq('id', form.id))
    } else {
      ;({ error } = await supabase.from('payments').insert(payload))
    }

    if (error) {
      toast.error('Erro ao salvar pagamento')
    } else {
      if (payload.status === 'paid') {
        await supabase.from('transactions').insert({
          user_id: user.id,
          type: 'income',
          category: 'classes',
          amount: payload.amount,
          description: `Pagamento de aula(s)`,
          occurred_on: format(new Date(), 'yyyy-MM-dd'),
        })
      }
      toast.success(form.id ? 'Pagamento atualizado' : 'Pagamento registrado')
      setShowModal(false)
      loadAll()
    }
    setSaving(false)
  }

  async function markPaid(p) {
    const { error } = await supabase
      .from('payments')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', p.id)
    if (error) {
      toast.error('Erro ao marcar como pago')
      return
    }
    await supabase.from('transactions').insert({
      user_id: user.id,
      type: 'income',
      category: 'classes',
      amount: p.amount,
      description: `Pagamento - ${p.students?.name ?? ''}`,
      occurred_on: format(new Date(), 'yyyy-MM-dd'),
      payment_id: p.id,
    })
    toast.success('Marcado como pago')
    loadAll()
  }

  async function handleDelete(id) {
    if (!confirm('Remover este registro de pagamento?')) return
    const { error } = await supabase.from('payments').delete().eq('id', id)
    if (error) toast.error('Erro ao remover')
    else {
      toast.success('Removido')
      loadAll()
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Pagamentos</h1>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> Registrar
        </button>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2">
        <SummaryCard label="A receber (mês)" value={formatCurrency(monthSummary.aReceber)} tone="amber" />
        <SummaryCard label="Recebido (mês)" value={formatCurrency(monthSummary.recebido)} tone="emerald" />
        <SummaryCard label="Inadimplentes" value={monthSummary.inadimplentes} tone="red" />
      </div>

      <div className="mb-5 flex items-center gap-2 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-3">
        <Sparkles className="h-4 w-4 shrink-0 text-indigo-500" />
        <p className="flex-1 text-xs text-slate-600">
          Gerar pagamentos pendentes de outro mês (o do mês atual já é gerado sozinho ao abrir esta tela).
        </p>
        <input
          type="month"
          value={genMonth}
          onChange={(e) => setGenMonth(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
        />
        <button
          onClick={handleGenerateMonth}
          disabled={generating}
          className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {generating ? 'Gerando…' : 'Gerar'}
        </button>
      </div>

      <div className="mb-4 flex gap-1.5 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
              filter === f.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-400">
          Nenhum pagamento encontrado.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-slate-900">{p.students?.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PAYMENT_STATUS[p.status].className}`}>
                      {PAYMENT_STATUS[p.status].label}
                    </span>
                    {p.isOverdue && p.status !== 'late' && (
                      <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
                        <AlertTriangle className="h-3 w-3" /> {p.daysOverdue}d atraso
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatCurrency(p.amount)}
                    {p.due_date && ` · vencimento ${formatDate(p.due_date)}`}
                    {p.paid_at && ` · pago em ${formatDate(p.paid_at)}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {p.status !== 'paid' && (
                    <button
                      onClick={() => markPaid(p)}
                      title="Marcar como pago"
                      className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => openEdit(p)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={form.id ? 'Editar pagamento' : 'Registrar pagamento'}>
        <form id="payment-form" onSubmit={handleSave} className="space-y-4">
          <Field label="Aluno">
            <select
              required
              value={form.student_id}
              onChange={(e) => onStudentChange(e.target.value)}
              className="input"
            >
              <option value="">Selecione…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
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
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="input"
              >
                {Object.entries(PAYMENT_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Mês de referência">
              <input
                type="date"
                value={form.reference_month}
                onChange={(e) => setForm({ ...form, reference_month: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Vencimento">
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="input"
              />
            </Field>
          </div>

          <Field label="Forma de pagamento">
            <input
              value={form.payment_method}
              onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              className="input"
              placeholder="Pix, transferência…"
            />
          </Field>

          <Field label="Notas">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input"
              rows={2}
            />
          </Field>
        </form>
        <div className="mt-2 flex gap-2 pt-2">
          <button
            type="submit"
            form="payment-form"
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

function SummaryCard({ label, value, tone }) {
  const tones = {
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
  }
  return (
    <div className={`rounded-xl p-3 ${tones[tone]}`}>
      <p className="text-[11px] font-medium opacity-80">{label}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
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
