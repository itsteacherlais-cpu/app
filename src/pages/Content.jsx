import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2, Flame, Target } from 'lucide-react'
import {
  formatDate, CONTENT_STATUS, CONTENT_STATUS_ORDER, CONTENT_FORMAT, CONTENT_PLATFORM,
} from '../lib/format'
import { getPeriodRange } from '../lib/period'
import { format, isBefore, parseISO } from 'date-fns'

const EMPTY_ITEM = {
  id: null,
  title: '',
  format: 'short',
  platforms: ['instagram'],
  planned_publish_date: '',
  notes: '',
}

const STREAK_TO_SUGGEST_INCREASE = 3

export default function Content() {
  const { user } = useAuth()
  const [tab, setTab] = useState('quadro')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_ITEM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadItems()
  }, [])

  async function loadItems() {
    setLoading(true)
    const { data, error } = await supabase
      .from('content_items')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) toast.error('Erro ao carregar conteúdo')
    else setItems(data)
    setLoading(false)
  }

  function openNew() {
    setForm(EMPTY_ITEM)
    setShowModal(true)
  }

  function openEdit(item) {
    setForm({
      ...item,
      platforms: item.platforms || [],
      planned_publish_date: item.planned_publish_date || '',
      notes: item.notes || '',
    })
    setShowModal(true)
  }

  function togglePlatform(key) {
    setForm((f) => ({
      ...f,
      platforms: f.platforms.includes(key) ? f.platforms.filter((p) => p !== key) : [...f.platforms, key],
    }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (form.platforms.length === 0) {
      toast.error('Selecione pelo menos uma plataforma')
      return
    }
    setSaving(true)
    const payload = {
      user_id: user.id,
      title: form.title.trim(),
      format: form.format,
      platforms: form.platforms,
      planned_publish_date: form.planned_publish_date || null,
      notes: form.notes.trim() || null,
    }

    let error
    if (form.id) {
      ;({ error } = await supabase.from('content_items').update(payload).eq('id', form.id))
    } else {
      ;({ error } = await supabase.from('content_items').insert({ ...payload, status: 'idea' }))
    }

    if (error) toast.error('Erro ao salvar')
    else {
      toast.success(form.id ? 'Atualizado' : 'Criado')
      setShowModal(false)
      loadItems()
    }
    setSaving(false)
  }

  async function moveStatus(item, direction) {
    const idx = CONTENT_STATUS_ORDER.indexOf(item.status)
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= CONTENT_STATUS_ORDER.length) return
    const newStatus = CONTENT_STATUS_ORDER[newIdx]
    const payload = { status: newStatus }
    if (newStatus === 'published' && !item.published_date) {
      payload.published_date = format(new Date(), 'yyyy-MM-dd')
    }
    const { error } = await supabase.from('content_items').update(payload).eq('id', item.id)
    if (error) toast.error('Erro ao mover')
    else loadItems()
  }

  async function handleDelete(id) {
    if (!confirm('Excluir este item?')) return
    const { error } = await supabase.from('content_items').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir')
    else {
      toast.success('Excluído')
      loadItems()
    }
  }

  const columns = useMemo(() => {
    const map = Object.fromEntries(CONTENT_STATUS_ORDER.map((s) => [s, []]))
    for (const item of items) {
      if (map[item.status]) map[item.status].push(item)
    }
    return map
  }, [items])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Conteúdo</h1>
        {tab === 'quadro' && (
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Novo
          </button>
        )}
      </div>

      <div className="mb-5 flex gap-1.5">
        {[
          ['quadro', 'Quadro'],
          ['metas', 'Metas & Relatórios'],
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

      {tab === 'quadro' ? (
        loading ? (
          <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-4">
            {CONTENT_STATUS_ORDER.map((status) => (
              <div key={status} className="w-64 shrink-0">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${CONTENT_STATUS[status].className}`}>
                    {CONTENT_STATUS[status].label}
                  </span>
                  <span className="text-xs text-slate-400">{columns[status].length}</span>
                </div>
                <div className="space-y-2">
                  {columns[status].length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-300">
                      Vazio
                    </div>
                  ) : (
                    columns[status].map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-sm font-medium text-slate-900">{item.title}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {CONTENT_FORMAT[item.format] || '—'} ·{' '}
                          {item.platforms?.length ? item.platforms.map((p) => CONTENT_PLATFORM[p] || p).join(', ') : '—'}
                          {item.planned_publish_date && ` · ${formatDate(item.planned_publish_date)}`}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex gap-0.5">
                            <button
                              onClick={() => moveStatus(item, -1)}
                              disabled={CONTENT_STATUS_ORDER.indexOf(item.status) === 0}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-20"
                            >
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => moveStatus(item, 1)}
                              disabled={CONTENT_STATUS_ORDER.indexOf(item.status) === CONTENT_STATUS_ORDER.length - 1}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-20"
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex gap-0.5">
                            <button onClick={() => openEdit(item)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleDelete(item.id)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <GoalsAndReports items={items} />
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={form.id ? 'Editar item' : 'Novo item'}>
        <form id="content-form" onSubmit={handleSave} className="space-y-4">
          <Field label="Título/tema">
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Formato">
            <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} className="input">
              <option value="short">Short</option>
              <option value="long">Longo</option>
            </select>
          </Field>
          <Field label="Plataformas (pode marcar mais de uma)">
            <div className="flex flex-wrap gap-2">
              {Object.entries(CONTENT_PLATFORM).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => togglePlatform(key)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                    form.platforms.includes(key)
                      ? 'border-indigo-600 bg-indigo-600 text-white'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Data prevista de publicação">
            <input
              type="date"
              value={form.planned_publish_date}
              onChange={(e) => setForm({ ...form, planned_publish_date: e.target.value })}
              className="input"
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
            form="content-form"
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

function GoalsAndReports({ items }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <GoalCard periodType="week" label="Meta semanal" items={items} />
        <GoalCard periodType="month" label="Meta mensal" items={items} />
      </div>
      <ReportsHistory />
    </div>
  )
}

function GoalCard({ periodType, label, items }) {
  const { user } = useAuth()
  const [goal, setGoal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [targetInput, setTargetInput] = useState('3')
  const [closeForm, setCloseForm] = useState({ summary: '', next_steps: '', next_target: '3' })
  const [saving, setSaving] = useState(false)

  const range = getPeriodRange(periodType)

  useEffect(() => {
    loadGoal()
  }, [])

  async function loadGoal() {
    setLoading(true)
    const { data } = await supabase
      .from('content_goals')
      .select('*')
      .eq('period_type', periodType)
      .order('period_start', { ascending: false })
      .limit(1)
    setGoal(data?.[0] || null)
    setLoading(false)
  }

  // "cycleEnded" = a meta mais recente já passou da data final e ainda não foi
  // fechada (ou seja, ainda não geramos o relatório e a próxima meta pra ela).
  const cycleEnded = !!goal && isBefore(parseISO(goal.period_end), new Date())

  // Comparação por string ("yyyy-MM-dd"), não por Date: period_start/end e
  // published_date são colunas "date" puras do Postgres, então comparar como
  // texto evita qualquer problema de fuso horário na conversão pra Date.
  const producedCount = useMemo(() => {
    if (!goal) return 0
    return items.filter(
      (i) =>
        i.status === 'published' &&
        i.published_date &&
        i.published_date >= goal.period_start &&
        i.published_date <= goal.period_end
    ).length
  }, [items, goal])

  const progressPct = goal ? Math.min(100, Math.round((producedCount / goal.target_count) * 100)) : 0

  async function handleSetGoal(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      user_id: user.id,
      period_type: periodType,
      target_count: Number(targetInput),
      period_start: format(range.start, 'yyyy-MM-dd'),
      period_end: format(range.end, 'yyyy-MM-dd'),
      streak_count: goal?.streak_count || 0,
    }
    let error
    if (goal && !cycleEnded) {
      ;({ error } = await supabase.from('content_goals').update({ target_count: payload.target_count }).eq('id', goal.id))
    } else {
      ;({ error } = await supabase.from('content_goals').insert(payload))
    }
    if (error) toast.error('Erro ao salvar meta')
    else {
      toast.success('Meta definida')
      setShowEdit(false)
      loadGoal()
    }
    setSaving(false)
  }

  async function handleCloseCycle(e) {
    e.preventDefault()
    setSaving(true)
    const hitTarget = producedCount >= goal.target_count
    const newStreak = hitTarget ? (goal.streak_count || 0) + 1 : 0

    const { error: reportError } = await supabase.from('content_reports').insert({
      user_id: user.id,
      period_start: goal.period_start,
      period_end: goal.period_end,
      produced_count: producedCount,
      target_count: goal.target_count,
      summary: closeForm.summary || null,
      next_steps: closeForm.next_steps || null,
    })

    const nextStart = parseISO(goal.period_end)
    nextStart.setDate(nextStart.getDate() + 1)
    const nextRange = getPeriodRange(periodType, nextStart)

    const { error: goalError } = await supabase.from('content_goals').insert({
      user_id: user.id,
      period_type: periodType,
      target_count: Number(closeForm.next_target),
      period_start: format(nextRange.start, 'yyyy-MM-dd'),
      period_end: format(nextRange.end, 'yyyy-MM-dd'),
      streak_count: newStreak,
    })

    if (reportError || goalError) {
      toast.error('Erro ao fechar ciclo')
    } else {
      toast.success('Ciclo fechado! Nova meta criada.')
      if (newStreak > 0 && newStreak % STREAK_TO_SUGGEST_INCREASE === 0) {
        await supabase.from('achievements').insert({
          user_id: user.id,
          title: `🔥 ${newStreak} ciclos de meta de conteúdo seguidos!`,
          description: `Meta ${label.toLowerCase()} batida ${newStreak} vezes seguidas.`,
          milestone_type: 'conteudo',
        })
        toast.success('Conquista desbloqueada! Confira em Conquistas & Recompensas 🏆', { duration: 4000 })
      }
      setShowClose(false)
      loadGoal()
    }
    setSaving(false)
  }

  function openCloseModal() {
    const hitTarget = producedCount >= goal.target_count
    const newStreak = hitTarget ? (goal.streak_count || 0) + 1 : 0
    const suggestIncrease = newStreak > 0 && newStreak % STREAK_TO_SUGGEST_INCREASE === 0
    setCloseForm({
      summary: '',
      next_steps: '',
      next_target: String(suggestIncrease ? goal.target_count + 1 : goal.target_count),
    })
    setShowClose(true)
  }

  if (loading) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">Carregando…</div>
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <Target className="h-4 w-4 text-indigo-600" /> {label}
        </h3>
        {goal?.streak_count > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">
            <Flame className="h-3 w-3" /> {goal.streak_count}x seguidas
          </span>
        )}
      </div>

      {!goal ? (
        <div>
          <p className="mb-2 text-sm text-slate-400">Nenhuma meta definida ainda.</p>
          <button
            onClick={() => {
              setTargetInput('3')
              setShowEdit(true)
            }}
            className="text-xs font-medium text-indigo-600 hover:underline"
          >
            + definir meta
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-400">
            {formatDate(goal.period_start)} – {formatDate(goal.period_end)}
            {cycleEnded && ' · ciclo encerrado'}
          </p>
          <p className="mt-2 text-sm text-slate-700">
            <span className="text-lg font-semibold text-slate-900">{producedCount}</span> / {goal.target_count} publicados
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${progressPct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-3 flex gap-3">
            {!cycleEnded && (
              <button
                onClick={() => {
                  setTargetInput(String(goal.target_count))
                  setShowEdit(true)
                }}
                className="text-xs font-medium text-indigo-600 hover:underline"
              >
                Editar meta
              </button>
            )}
            {cycleEnded && (
              <button onClick={openCloseModal} className="text-xs font-medium text-emerald-600 hover:underline">
                Fechar ciclo →
              </button>
            )}
          </div>
        </>
      )}

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={`Definir ${label.toLowerCase()}`}>
        <form onSubmit={handleSetGoal} className="space-y-4">
          <Field label="Quantos vídeos/posts você quer publicar neste período?">
            <input
              type="number"
              min="1"
              required
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className="input"
            />
          </Field>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </form>
      </Modal>

      {goal && (
        <Modal open={showClose} onClose={() => setShowClose(false)} title="Fechar ciclo">
          <form onSubmit={handleCloseCycle} className="space-y-4">
            <p className="text-sm text-slate-600">
              Você produziu <strong>{producedCount}</strong> de <strong>{goal.target_count}</strong> planejados.{' '}
              {producedCount >= goal.target_count ? '🎉 Meta batida!' : 'Ainda não bateu dessa vez.'}
            </p>
            <Field label="O que não saiu / motivo (opcional)">
              <textarea
                value={closeForm.summary}
                onChange={(e) => setCloseForm({ ...closeForm, summary: e.target.value })}
                className="input"
                rows={2}
              />
            </Field>
            <Field label="Próximos passos (opcional)">
              <textarea
                value={closeForm.next_steps}
                onChange={(e) => setCloseForm({ ...closeForm, next_steps: e.target.value })}
                className="input"
                rows={2}
              />
            </Field>
            <Field label="Meta para o próximo ciclo">
              <input
                type="number"
                min="1"
                required
                value={closeForm.next_target}
                onChange={(e) => setCloseForm({ ...closeForm, next_target: e.target.value })}
                className="input"
              />
            </Field>
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Salvando…' : 'Fechar ciclo e criar próxima meta'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}

function ReportsHistory() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('content_reports')
      .select('*')
      .order('period_start', { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error('Erro ao carregar relatórios')
        else setReports(data)
        setLoading(false)
      })
  }, [])

  if (loading) return null
  if (reports.length === 0) return null

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-slate-800">Histórico de relatórios</h3>
      <div className="space-y-2">
        {reports.map((r) => (
          <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-800">
                {formatDate(r.period_start)} – {formatDate(r.period_end)}
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  r.produced_count >= r.target_count ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}
              >
                {r.produced_count}/{r.target_count}
              </span>
            </div>
            {r.summary && <p className="mt-1 text-xs text-slate-500">{r.summary}</p>}
            {r.next_steps && <p className="mt-1 text-xs text-slate-400">Próximos passos: {r.next_steps}</p>}
          </div>
        ))}
      </div>
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
