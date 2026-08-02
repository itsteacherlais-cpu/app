import { useEffect, useMemo, useState } from 'react'
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths,
  eachDayOfInterval, isSameDay, isSameMonth, isToday, format, setHours, setMinutes,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import {
  Plus, ChevronLeft, ChevronRight, Video, RefreshCw, Pencil, Trash2, Check, X as XIcon, Download,
} from 'lucide-react'
import { formatTime, formatCurrency, CLASS_STATUS } from '../lib/format'
import {
  createZoomMeetingForClass, updateZoomMeeting, deleteZoomMeeting, syncZoomMeeting,
  listImportableZoomMeetings, importZoomMeeting,
} from '../lib/zoomApi'

const DISMISSED_ZOOM_KEY = 'teacherlais_dismissed_zoom_meetings'

function normalizeName(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Tenta adivinhar o aluno pelo nome que aparece no título da reunião do Zoom.
// Só assume o palpite quando é o único aluno compatível, pra não errar entre
// alunos com nomes parecidos.
function guessStudentForTopic(topic, students) {
  const normTopic = normalizeName(topic)
  if (!normTopic) return null

  const fullNameMatches = students.filter((s) => {
    const n = normalizeName(s.name)
    return n && normTopic.includes(n)
  })
  if (fullNameMatches.length === 1) return fullNameMatches[0]

  const topicWords = new Set(normTopic.split(' ').filter(Boolean))
  const firstNameMatches = students.filter((s) => {
    const first = normalizeName(s.name).split(' ')[0]
    return first && first.length > 2 && topicWords.has(first)
  })
  if (firstNameMatches.length === 1) return firstNameMatches[0]

  return null
}

function getDismissedZoomIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_ZOOM_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

function addDismissedZoomId(id) {
  const current = getDismissedZoomIds()
  current.add(String(id))
  localStorage.setItem(DISMISSED_ZOOM_KEY, JSON.stringify([...current]))
}

const EMPTY_FORM = {
  id: null,
  student_id: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  time: '14:00',
  duration_minutes: 60,
  recurrence: 'none', // none | weekly | biweekly
  repeat_count: 1,
  status: 'scheduled',
  create_zoom: true,
  notes: '',
}

export default function Calendar() {
  const { user } = useAuth()
  const [view, setView] = useState('week')
  const [anchor, setAnchor] = useState(new Date())
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [selectedDay, setSelectedDay] = useState(null)
  const [syncingId, setSyncingId] = useState(null)
  const [importable, setImportable] = useState([])
  const [loadingImportable, setLoadingImportable] = useState(false)
  const [importPicks, setImportPicks] = useState({})
  const [importingId, setImportingId] = useState(null)
  const [importingAll, setImportingAll] = useState(false)

  const range = useMemo(() => {
    if (view === 'week') {
      return { start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) }
    }
    return {
      start: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
    }
  }, [view, anchor])

  useEffect(() => {
    loadStudents()
    loadImportable()
  }, [])

  useEffect(() => {
    loadClasses()
  }, [range.start, range.end])

  async function loadStudents() {
    const { data } = await supabase.from('students').select('*').order('name')
    setStudents(data || [])
  }

  async function loadImportable() {
    setLoadingImportable(true)
    try {
      const { meetings } = await listImportableZoomMeetings()
      const dismissed = getDismissedZoomIds()
      setImportable((meetings || []).filter((m) => !dismissed.has(String(m.id))))
    } catch (err) {
      toast.error(err.message || 'Erro ao buscar reuniões do Zoom')
    } finally {
      setLoadingImportable(false)
    }
  }

  useEffect(() => {
    if (!importable.length || !students.length) return
    setImportPicks((prev) => {
      const next = { ...prev }
      let changed = false
      for (const m of importable) {
        if (next[m.id] === undefined) {
          const guess = guessStudentForTopic(m.topic, students)
          next[m.id] = guess ? guess.id : ''
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [importable, students])

  function handleDismiss(meeting) {
    addDismissedZoomId(meeting.id)
    setImportable((prev) => prev.filter((m) => m.id !== meeting.id))
  }

  async function handleImport(meeting) {
    const studentId = importPicks[meeting.id]
    if (!studentId) {
      toast.error('Selecione o aluno dessa reunião')
      return
    }
    setImportingId(meeting.id)
    try {
      await importZoomMeeting({ meetingId: meeting.id, studentId })
      setImportable((prev) => prev.filter((m) => m.id !== meeting.id))
      toast.success('Aula importada do Zoom')
      loadClasses()
    } catch (err) {
      toast.error(err.message || 'Erro ao importar reunião')
    } finally {
      setImportingId(null)
    }
  }

  async function handleImportAll() {
    const toImport = importable.filter((m) => importPicks[m.id])
    if (toImport.length === 0) {
      toast.error('Nenhuma reunião com aluno selecionado ainda')
      return
    }
    setImportingAll(true)
    let successCount = 0
    for (const m of toImport) {
      try {
        await importZoomMeeting({ meetingId: m.id, studentId: importPicks[m.id] })
        successCount++
        setImportable((prev) => prev.filter((x) => x.id !== m.id))
      } catch (err) {
        toast.error(`Falha ao importar "${m.topic}": ${err.message || 'erro'}`)
      }
    }
    if (successCount > 0) {
      toast.success(`${successCount} aula(s) importada(s) do Zoom`)
      loadClasses()
    }
    setImportingAll(false)
  }

  async function loadClasses() {
    setLoading(true)
    const { data, error } = await supabase
      .from('classes')
      .select('*, students(id, name, rate_value, rate_type)')
      .gte('scheduled_at', range.start.toISOString())
      .lte('scheduled_at', range.end.toISOString())
      .order('scheduled_at', { ascending: true })
    if (error) toast.error('Erro ao carregar aulas')
    else setClasses(data)
    setLoading(false)
  }

  function classesForDay(day) {
    return classes.filter((c) => isSameDay(new Date(c.scheduled_at), day))
  }

  function openNew(day) {
    setForm({ ...EMPTY_FORM, date: format(day || new Date(), 'yyyy-MM-dd') })
    setShowModal(true)
  }

  function openEdit(c) {
    const dt = new Date(c.scheduled_at)
    setForm({
      id: c.id,
      student_id: c.student_id,
      date: format(dt, 'yyyy-MM-dd'),
      time: format(dt, 'HH:mm'),
      duration_minutes: c.duration_minutes,
      recurrence: 'none',
      repeat_count: 1,
      status: c.status,
      create_zoom: !c.zoom_meeting_id,
      notes: c.notes || '',
      zoom_meeting_id: c.zoom_meeting_id,
    })
    setShowModal(true)
  }

  function buildOccurrenceDates() {
    const [h, m] = form.time.split(':').map(Number)
    const base = setMinutes(setHours(new Date(`${form.date}T00:00:00`), h), m)
    const count = form.recurrence === 'none' ? 1 : Math.min(Number(form.repeat_count) || 1, 24)
    const stepDays = form.recurrence === 'biweekly' ? 14 : 7
    const dates = [base]
    for (let i = 1; i < count; i++) {
      const d = new Date(base)
      d.setDate(d.getDate() + stepDays * i)
      dates.push(d)
    }
    return dates
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!form.student_id) {
      toast.error('Selecione um aluno')
      return
    }
    setSaving(true)
    const student = students.find((s) => s.id === form.student_id)

    try {
      if (form.id) {
        const [h, m] = form.time.split(':').map(Number)
        const scheduledAt = setMinutes(setHours(new Date(`${form.date}T00:00:00`), h), m)
        const { error } = await supabase
          .from('classes')
          .update({
            student_id: form.student_id,
            scheduled_at: scheduledAt.toISOString(),
            duration_minutes: Number(form.duration_minutes),
            status: form.status,
            notes: form.notes || null,
          })
          .eq('id', form.id)
        if (error) throw error

        if (form.zoom_meeting_id) {
          if (form.status === 'canceled') {
            await deleteZoomMeeting(form.zoom_meeting_id).catch(() => {})
          } else {
            await updateZoomMeeting(form.zoom_meeting_id, {
              topic: `Aula de inglês - ${student?.name ?? ''}`,
              startTime: scheduledAt.toISOString(),
              durationMinutes: Number(form.duration_minutes),
            }).catch(() => toast.error('Aula salva, mas falhou ao sincronizar com o Zoom'))
          }
        } else if (form.create_zoom) {
          await createZoomMeetingForClass({
            classId: form.id,
            topic: `Aula de inglês - ${student?.name ?? ''}`,
            startTime: scheduledAt.toISOString(),
            durationMinutes: Number(form.duration_minutes),
          }).catch(() => toast.error('Aula salva, mas falhou ao criar reunião no Zoom'))
        }

        toast.success('Aula atualizada')
      } else {
        const dates = buildOccurrenceDates()
        const rows = dates.map((d) => ({
          user_id: user.id,
          student_id: form.student_id,
          scheduled_at: d.toISOString(),
          duration_minutes: Number(form.duration_minutes),
          status: 'scheduled',
          recurrence_rule: form.recurrence !== 'none' ? form.recurrence : null,
          notes: form.notes || null,
        }))
        const { data: inserted, error } = await supabase.from('classes').insert(rows).select()
        if (error) throw error

        if (form.create_zoom) {
          await Promise.all(
            inserted.map((c) =>
              createZoomMeetingForClass({
                classId: c.id,
                topic: `Aula de inglês - ${student?.name ?? ''}`,
                startTime: c.scheduled_at,
                durationMinutes: c.duration_minutes,
              }).catch(() => null)
            )
          )
        }
        toast.success(`${rows.length} aula(s) criada(s)`)
      }

      setShowModal(false)
      loadClasses()
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar aula')
    } finally {
      setSaving(false)
    }
  }

  async function quickStatus(c, status) {
    const { error } = await supabase.from('classes').update({ status }).eq('id', c.id)
    if (error) toast.error('Erro ao atualizar status')
    else {
      toast.success('Status atualizado')
      loadClasses()
      if (status === 'canceled' && c.zoom_meeting_id) {
        deleteZoomMeeting(c.zoom_meeting_id).catch(() => {})
      }
    }
  }

  async function handleDelete(c) {
    if (!confirm('Excluir esta aula?')) return
    if (c.zoom_meeting_id) await deleteZoomMeeting(c.zoom_meeting_id).catch(() => {})
    const { error } = await supabase.from('classes').delete().eq('id', c.id)
    if (error) toast.error('Erro ao excluir aula')
    else {
      toast.success('Aula excluída')
      loadClasses()
    }
  }

  async function handleSync(c) {
    setSyncingId(c.id)
    try {
      await syncZoomMeeting(c.zoom_meeting_id)
      toast.success('Sincronizado com o Zoom')
      loadClasses()
    } catch (err) {
      toast.error(err.message || 'Erro ao sincronizar')
    } finally {
      setSyncingId(null)
    }
  }

  const weekDays = useMemo(
    () => eachDayOfInterval({ start: range.start, end: range.end }),
    [range]
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Aulas</h1>
        <button
          onClick={() => openNew(selectedDay)}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> Nova aula
        </button>
      </div>

      {importable.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-amber-900">
              {importable.length} aula{importable.length > 1 ? 's' : ''} marcada{importable.length > 1 ? 's' : ''} no Zoom pra importar
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleImportAll}
                disabled={importingAll || !importable.some((m) => importPicks[m.id])}
                className="rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {importingAll ? 'Importando…' : 'Importar todas'}
              </button>
              <button
                onClick={loadImportable}
                disabled={loadingImportable}
                className="rounded-lg p-1.5 text-amber-700 hover:bg-amber-100"
                title="Atualizar lista"
              >
                <RefreshCw className={`h-4 w-4 ${loadingImportable ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          <p className="mb-2 text-xs text-amber-700">
            Já tentamos adivinhar o aluno pelo nome da reunião. Confira se está tudo certo e clique em <strong>"Importar todas"</strong> pra trazer todas de uma vez, ou ajuste/importe uma por uma. Se não for aula de aluno (ex.: reunião de teste), clique em "Ignorar".
          </p>
          <div className="space-y-2">
            {importable.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{m.topic}</p>
                  <p className="text-xs text-slate-400">
                    {format(new Date(m.startTime), "d MMM 'às' HH:mm", { locale: ptBR })} · {m.durationMinutes} min
                  </p>
                </div>
                <select
                  value={importPicks[m.id] || ''}
                  onChange={(e) => setImportPicks({ ...importPicks, [m.id]: e.target.value })}
                  className="input w-40 text-sm"
                >
                  <option value="">Aluno…</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleImport(m)}
                  disabled={importingId === m.id}
                  className="flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  <Download className="h-3.5 w-3.5" /> Importar
                </button>
                <button
                  onClick={() => handleDismiss(m)}
                  className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  title="Não é aula de aluno, ignorar essa reunião"
                >
                  Ignorar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAnchor(view === 'week' ? addWeeks(anchor, -1) : addMonths(anchor, -1))}
            className="rounded-lg p-2 hover:bg-slate-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setAnchor(new Date())} className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">
            Hoje
          </button>
          <button
            onClick={() => setAnchor(view === 'week' ? addWeeks(anchor, 1) : addMonths(anchor, 1))}
            className="rounded-lg p-2 hover:bg-slate-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="ml-1 text-sm font-medium capitalize text-slate-700">
            {view === 'week'
              ? `${format(range.start, 'd MMM', { locale: ptBR })} – ${format(range.end, 'd MMM', { locale: ptBR })}`
              : format(anchor, 'MMMM yyyy', { locale: ptBR })}
          </span>
        </div>
        <div className="flex rounded-lg border border-slate-200 p-0.5">
          {['week', 'month'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                view === v ? 'bg-indigo-600 text-white' : 'text-slate-500'
              }`}
            >
              {v === 'week' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
      ) : view === 'week' ? (
        <div className="space-y-4">
          {weekDays.map((day) => (
            <DaySection
              key={day.toISOString()}
              day={day}
              items={classesForDay(day)}
              onNew={() => openNew(day)}
              onEdit={openEdit}
              onDelete={handleDelete}
              onQuickStatus={quickStatus}
              onSync={handleSync}
              syncingId={syncingId}
            />
          ))}
        </div>
      ) : (
        <MonthGrid
          anchor={anchor}
          days={weekDays}
          classesForDay={classesForDay}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
        />
      )}

      {view === 'month' && selectedDay && (
        <div className="mt-4">
          <DaySection
            day={selectedDay}
            items={classesForDay(selectedDay)}
            onNew={() => openNew(selectedDay)}
            onEdit={openEdit}
            onDelete={handleDelete}
            onQuickStatus={quickStatus}
            onSync={handleSync}
            syncingId={syncingId}
          />
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={form.id ? 'Editar aula' : 'Nova aula'}>
        <form id="class-form" onSubmit={handleSave} className="space-y-4">
          <Field label="Aluno">
            <select
              required
              value={form.student_id}
              onChange={(e) => setForm({ ...form, student_id: e.target.value })}
              className="input"
            >
              <option value="">Selecione…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Horário">
              <input
                type="time"
                required
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="input"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Duração (min)">
              <input
                type="number"
                min="15"
                step="15"
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                className="input"
              />
            </Field>
            {form.id ? (
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="input"
                >
                  {Object.entries(CLASS_STATUS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Recorrência">
                <select
                  value={form.recurrence}
                  onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
                  className="input"
                >
                  <option value="none">Avulsa</option>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quinzenal</option>
                </select>
              </Field>
            )}
          </div>

          {!form.id && form.recurrence !== 'none' && (
            <Field label="Repetir quantas vezes">
              <input
                type="number"
                min="1"
                max="24"
                value={form.repeat_count}
                onChange={(e) => setForm({ ...form, repeat_count: e.target.value })}
                className="input"
              />
            </Field>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.create_zoom}
              onChange={(e) => setForm({ ...form, create_zoom: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              disabled={form.id && !!form.zoom_meeting_id}
            />
            Criar/atualizar reunião automaticamente no Zoom
          </label>

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
            form="class-form"
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

function DaySection({ day, items, onNew, onEdit, onDelete, onQuickStatus, onSync, syncingId }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <p className={`text-sm font-medium capitalize ${isToday(day) ? 'text-indigo-600' : 'text-slate-700'}`}>
          {format(day, "EEEE, d 'de' MMM", { locale: ptBR })}
        </p>
        <button onClick={onNew} className="text-xs font-medium text-indigo-600 hover:underline">
          + aula
        </button>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-4 text-xs text-slate-400">Sem aulas</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">{formatTime(c.scheduled_at)}</p>
                  <p className="truncate text-sm text-slate-700">{c.students?.name}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${CLASS_STATUS[c.status].className}`}>
                    {CLASS_STATUS[c.status].label}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {c.duration_minutes} min · {formatCurrency(c.students?.rate_value)}
                  {c.zoom_meeting_id && ' · Zoom sincronizado'}
                </p>
                {c.zoom_join_url && (
                  <a
                    href={c.zoom_join_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
                  >
                    <Video className="h-3.5 w-3.5" /> Entrar na reunião
                  </a>
                )}
              </div>
              <div className="flex shrink-0 gap-0.5">
                {c.status === 'scheduled' && (
                  <button onClick={() => onQuickStatus(c, 'completed')} title="Marcar como realizada" className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600">
                    <Check className="h-4 w-4" />
                  </button>
                )}
                {c.status === 'scheduled' && (
                  <button onClick={() => onQuickStatus(c, 'canceled')} title="Cancelar" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                    <XIcon className="h-4 w-4" />
                  </button>
                )}
                {c.zoom_meeting_id && (
                  <button
                    onClick={() => onSync(c)}
                    disabled={syncingId === c.id}
                    title="Sincronizar com Zoom"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncingId === c.id ? 'animate-spin' : ''}`} />
                  </button>
                )}
                <button onClick={() => onEdit(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => onDelete(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MonthGrid({ anchor, days, classesForDay, selectedDay, onSelectDay }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid grid-cols-7 border-b border-slate-100 text-center text-[11px] font-medium text-slate-400">
        {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const items = classesForDay(day)
          const inMonth = isSameMonth(day, anchor)
          const selected = selectedDay && isSameDay(day, selectedDay)
          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={`flex h-16 flex-col items-center justify-start gap-1 border-b border-r border-slate-100 py-1.5 text-xs ${
                inMonth ? 'text-slate-700' : 'text-slate-300'
              } ${selected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full ${isToday(day) ? 'bg-indigo-600 text-white' : ''}`}>
                {format(day, 'd')}
              </span>
              {items.length > 0 && (
                <span className="rounded-full bg-indigo-100 px-1.5 text-[10px] font-medium text-indigo-700">
                  {items.length}
                </span>
              )}
            </button>
          )
        })}
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
