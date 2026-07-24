import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Trophy, Gift, Check } from 'lucide-react'
import { formatDate } from '../lib/format'

const POINTS_PER_ACHIEVEMENT = 10

const TABS = [
  ['conquistas', 'Conquistas'],
  ['recompensas', 'Recompensas'],
]

export default function Achievements() {
  const [tab, setTab] = useState('conquistas')

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Conquistas & Recompensas</h1>
      <div className="mb-5 flex gap-1.5">
        {TABS.map(([key, label]) => (
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
      {tab === 'conquistas' ? <AchievementsList /> : <RewardsList />}
    </div>
  )
}

function AchievementsList() {
  const [achievements, setAchievements] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('achievements')
      .select('*')
      .order('unlocked_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error('Erro ao carregar conquistas')
        else setAchievements(data)
        setLoading(false)
      })
  }, [])

  if (loading) return <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>

  return (
    <div>
      <div className="mb-4 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 p-5 text-white">
        <p className="text-xs opacity-80">Pontos acumulados</p>
        <p className="text-3xl font-bold">{achievements.length * POINTS_PER_ACHIEVEMENT}</p>
        <p className="mt-1 text-xs opacity-80">{achievements.length} conquista(s) desbloqueada(s)</p>
      </div>

      {achievements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-400">
          <Trophy className="mx-auto mb-2 h-6 w-6 text-slate-300" />
          Nenhuma conquista ainda. Elas aparecem sozinhas quando você bate metas de conteúdo seguidas ou fecha um mês
          de pagamentos 100% em dia.
        </div>
      ) : (
        <div className="space-y-2">
          {achievements.map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5">
              <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">{a.title}</p>
                {a.description && <p className="text-xs text-slate-500">{a.description}</p>}
                <p className="mt-0.5 text-[11px] text-slate-400">{formatDate(a.unlocked_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const EMPTY_REWARD = { id: null, title: '', milestone_description: '' }

function RewardsList() {
  const { user } = useAuth()
  const [rewards, setRewards] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_REWARD)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('rewards').select('*').order('achieved').order('created_at', { ascending: false })
    if (error) toast.error('Erro ao carregar recompensas')
    else setRewards(data)
    setLoading(false)
  }

  function openNew() {
    setForm(EMPTY_REWARD)
    setShowModal(true)
  }
  function openEdit(r) {
    setForm({ id: r.id, title: r.title, milestone_description: r.milestone_description || '' })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      user_id: user.id,
      title: form.title.trim(),
      milestone_description: form.milestone_description.trim() || null,
    }
    let error
    if (form.id) {
      ;({ error } = await supabase.from('rewards').update(payload).eq('id', form.id))
    } else {
      ;({ error } = await supabase.from('rewards').insert(payload))
    }
    if (error) toast.error('Erro ao salvar')
    else {
      toast.success('Salvo')
      setShowModal(false)
      load()
    }
    setSaving(false)
  }

  async function toggleAchieved(r) {
    const { error } = await supabase
      .from('rewards')
      .update({ achieved: !r.achieved, achieved_at: !r.achieved ? new Date().toISOString() : null })
      .eq('id', r.id)
    if (error) toast.error('Erro ao atualizar')
    else load()
  }

  async function handleDelete(id) {
    if (!confirm('Excluir esta recompensa?')) return
    const { error } = await supabase.from('rewards').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir')
    else {
      toast.success('Excluída')
      load()
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button onClick={openNew} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          <Plus className="h-4 w-4" /> Nova recompensa
        </button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
      ) : rewards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-400">
          <Gift className="mx-auto mb-2 h-6 w-6 text-slate-300" />
          Nenhuma recompensa cadastrada. Ex.: "ao chegar em 10 mil inscritos, comprar uma câmera nova".
        </div>
      ) : (
        <div className="space-y-2">
          {rewards.map((r) => (
            <div key={r.id} className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3.5">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <button
                  onClick={() => toggleAchieved(r)}
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    r.achieved ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'
                  }`}
                >
                  {r.achieved && <Check className="h-3 w-3" />}
                </button>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${r.achieved ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{r.title}</p>
                  {r.milestone_description && <p className="text-xs text-slate-500">{r.milestone_description}</p>}
                  {r.achieved && r.achieved_at && <p className="text-[11px] text-emerald-600">conquistada em {formatDate(r.achieved_at)}</p>}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => openEdit(r)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(r.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={form.id ? 'Editar recompensa' : 'Nova recompensa'}>
        <form id="reward-form" onSubmit={handleSave} className="space-y-4">
          <Field label="Recompensa">
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" placeholder="Comprar uma câmera nova" />
          </Field>
          <Field label="Marco vinculado (opcional)">
            <textarea
              value={form.milestone_description}
              onChange={(e) => setForm({ ...form, milestone_description: e.target.value })}
              className="input"
              rows={2}
              placeholder="Ao chegar em 10 mil inscritos no YouTube"
            />
          </Field>
        </form>
        <div className="mt-2 flex gap-2 pt-2">
          <button type="submit" form="reward-form" disabled={saving} className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
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
