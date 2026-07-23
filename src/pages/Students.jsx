import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Search, MessageCircle, Mail, Pencil, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate, CEFR_LEVELS, STUDENT_STATUS } from '../lib/format'

const EMPTY_FORM = {
  id: null,
  name: '',
  whatsapp: '',
  email: '',
  level: 'A1',
  objective: '',
  rate_type: 'per_class',
  rate_value: '',
  package_classes_total: '',
  start_date: new Date().toISOString().slice(0, 10),
  status: 'active',
  notes: '',
}

export default function Students() {
  const { user } = useAuth()
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  async function loadStudents() {
    setLoading(true)
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('name', { ascending: true })
    if (error) toast.error('Erro ao carregar alunos')
    else setStudents(data)
    setLoading(false)
  }

  useEffect(() => {
    loadStudents()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter((s) => s.name.toLowerCase().includes(q))
  }, [students, search])

  function openNew() {
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  function openEdit(student) {
    setForm({
      ...student,
      rate_value: String(student.rate_value ?? ''),
      package_classes_total: student.package_classes_total ? String(student.package_classes_total) : '',
    })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      whatsapp: form.whatsapp.trim() || null,
      email: form.email.trim() || null,
      level: form.level,
      objective: form.objective.trim() || null,
      rate_type: form.rate_type,
      rate_value: Number(form.rate_value) || 0,
      package_classes_total: form.rate_type === 'package' ? Number(form.package_classes_total) || null : null,
      start_date: form.start_date,
      status: form.status,
      notes: form.notes.trim() || null,
    }

    let error
    if (form.id) {
      ;({ error } = await supabase.from('students').update(payload).eq('id', form.id))
    } else {
      ;({ error } = await supabase.from('students').insert(payload))
    }

    if (error) {
      toast.error('Erro ao salvar aluno')
    } else {
      toast.success(form.id ? 'Aluno atualizado' : 'Aluno cadastrado')
      setShowModal(false)
      loadStudents()
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Remover este aluno? Isso também remove aulas e pagamentos vinculados.')) return
    const { error } = await supabase.from('students').delete().eq('id', id)
    if (error) toast.error('Erro ao remover aluno')
    else {
      toast.success('Aluno removido')
      loadStudents()
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Alunos</h1>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> Novo aluno
        </button>
      </div>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar aluno…"
          className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-400">
          {students.length === 0 ? 'Nenhum aluno cadastrado ainda.' : 'Nenhum aluno encontrado.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-slate-900">{s.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STUDENT_STATUS[s.status].className}`}>
                    {STUDENT_STATUS[s.status].label}
                  </span>
                  {s.level && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                      {s.level}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  {s.whatsapp && (
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5" /> {s.whatsapp}
                    </span>
                  )}
                  {s.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" /> {s.email}
                    </span>
                  )}
                  <span>
                    {formatCurrency(s.rate_value)} / {s.rate_type === 'package' ? `pacote (${s.package_classes_total ?? '-'} aulas)` : 'aula'}
                  </span>
                  <span>desde {formatDate(s.start_date)}</span>
                </div>
              </div>
              <div className="ml-2 flex shrink-0 gap-1">
                <button
                  onClick={() => openEdit(s)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={form.id ? 'Editar aluno' : 'Novo aluno'}
      >
        <form id="student-form" onSubmit={handleSave} className="space-y-4">
          <Field label="Nome">
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="WhatsApp">
              <input
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                className="input"
                placeholder="(11) 99999-9999"
              />
            </Field>
            <Field label="E-mail">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nível">
              <select
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
                className="input"
              >
                {CEFR_LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="input"
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </Field>
          </div>

          <Field label="Objetivo">
            <textarea
              value={form.objective}
              onChange={(e) => setForm({ ...form, objective: e.target.value })}
              className="input"
              rows={2}
              placeholder="Ex.: fluência para viagem, entrevista de emprego…"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cobrança">
              <select
                value={form.rate_type}
                onChange={(e) => setForm({ ...form, rate_type: e.target.value })}
                className="input"
              >
                <option value="per_class">Por aula</option>
                <option value="package">Pacote/mensal</option>
              </select>
            </Field>
            <Field label={form.rate_type === 'package' ? 'Valor do pacote' : 'Valor da aula'}>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={form.rate_value}
                onChange={(e) => setForm({ ...form, rate_value: e.target.value })}
                className="input"
              />
            </Field>
          </div>

          {form.rate_type === 'package' && (
            <Field label="Nº de aulas no pacote">
              <input
                type="number"
                min="1"
                value={form.package_classes_total}
                onChange={(e) => setForm({ ...form, package_classes_total: e.target.value })}
                className="input"
              />
            </Field>
          )}

          <Field label="Data de início">
            <input
              type="date"
              required
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
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
            form="student-form"
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

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  )
}
