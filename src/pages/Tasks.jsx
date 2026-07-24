import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate, TASK_STATUS_ORDER, TASK_STATUS, TASK_CATEGORY, TASK_PRIORITY } from '../lib/format'
import { isBefore, parseISO } from 'date-fns'

const EMPTY_FORM = {
  id: null,
  title: '',
  category: 'manual',
  priority: 'media',
  due_date: '',
}

const CATEGORY_FILTERS = [
  ['all', 'Todas'],
  ['manual', 'Manuais/admin'],
  ['criativa', 'Criativas'],
]

export default function Tasks() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false })
    if (error) toast.error('Erro ao carregar tarefas')
    else setTasks(data)
    setLoading(false)
  }

  function openNew() {
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(t) {
    setForm({ ...t, due_date: t.due_date || '' })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      user_id: user.id,
      title: form.title.trim(),
      category: form.category,
      priority: form.priority,
      due_date: form.due_date || null,
    }
    let error
    if (form.id) {
      ;({ error } = await supabase.from('tasks').update(payload).eq('id', form.id))
    } else {
      ;({ error } = await supabase.from('tasks').insert({ ...payload, status: 'todo' }))
    }
    if (error) toast.error('Erro ao salvar tarefa')
    else {
      toast.success(form.id ? 'Atualizada' : 'Criada')
      setShowModal(false)
      load()
    }
    setSaving(false)
  }

  async function moveStatus(task, direction) {
    const idx = TASK_STATUS_ORDER.indexOf(task.status)
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= TASK_STATUS_ORDER.length) return
    const { error } = await supabase.from('tasks').update({ status: TASK_STATUS_ORDER[newIdx] }).eq('id', task.id)
    if (error) toast.error('Erro ao mover')
    else load()
  }

  async function handleDelete(id) {
    if (!confirm('Excluir esta tarefa?')) return
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir')
    else {
      toast.success('Excluída')
      load()
    }
  }

  const filteredTasks = useMemo(
    () => (categoryFilter === 'all' ? tasks : tasks.filter((t) => t.category === categoryFilter)),
    [tasks, categoryFilter]
  )

  const columns = useMemo(() => {
    const map = Object.fromEntries(TASK_STATUS_ORDER.map((s) => [s, []]))
    for (const t of filteredTasks) if (map[t.status]) map[t.status].push(t)
    return map
  }, [filteredTasks])

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Tarefas</h1>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> Nova tarefa
        </button>
      </div>

      <div className="mb-5 flex gap-1.5">
        {CATEGORY_FILTERS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setCategoryFilter(key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium ${
              categoryFilter === key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {TASK_STATUS_ORDER.map((status) => (
            <div key={status} className="w-72 shrink-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-medium text-slate-600">{TASK_STATUS[status].label}</span>
                <span className="text-xs text-slate-400">{columns[status].length}</span>
              </div>
              <div className="space-y-2">
                {columns[status].length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-xs text-slate-300">Vazio</div>
                ) : (
                  columns[status].map((task) => {
                    const overdue = task.due_date && task.status !== 'done' && isBefore(parseISO(task.due_date), new Date())
                    return (
                      <div
                        key={task.id}
                        className={`rounded-xl border-l-4 border-y border-r border-slate-200 bg-white p-3 ${TASK_CATEGORY[task.category].borderClassName}`}
                      >
                        <p className="text-sm font-medium text-slate-900">{task.title}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TASK_CATEGORY[task.category].className}`}>
                            {TASK_CATEGORY[task.category].label}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TASK_PRIORITY[task.priority].className}`}>
                            {TASK_PRIORITY[task.priority].label}
                          </span>
                          {task.due_date && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${overdue ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                              {formatDate(task.due_date)}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex gap-0.5">
                            <button onClick={() => moveStatus(task, -1)} disabled={TASK_STATUS_ORDER.indexOf(task.status) === 0} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-20">
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => moveStatus(task, 1)} disabled={TASK_STATUS_ORDER.indexOf(task.status) === TASK_STATUS_ORDER.length - 1} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-20">
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex gap-0.5">
                            <button onClick={() => openEdit(task)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => handleDelete(task.id)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={form.id ? 'Editar tarefa' : 'Nova tarefa'}>
        <form id="task-form" onSubmit={handleSave} className="space-y-4">
          <Field label="Título">
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" />
          </Field>
          <Field label="Categoria">
            <div className="flex gap-2">
              {Object.entries(TASK_CATEGORY).map(([key, v]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm({ ...form, category: key })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                    form.category === key ? v.className : 'border-slate-200 text-slate-400'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prioridade">
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="input">
                {Object.entries(TASK_PRIORITY).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Prazo (opcional)">
              <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="input" />
            </Field>
          </div>
        </form>
        <div className="mt-2 flex gap-2 pt-2">
          <button type="submit" form="task-form" disabled={saving} className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </Modal>
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
