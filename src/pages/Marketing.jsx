import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate } from '../lib/format'

const TABS = [
  ['funil', 'Funil'],
  ['postagens', 'Postagens'],
  ['parcerias', 'Parcerias'],
]

export default function Marketing() {
  const [tab, setTab] = useState('funil')

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Marketing & Infoproduto</h1>
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

      {tab === 'funil' && <LeadsFunnel />}
      {tab === 'postagens' && <SocialPosts />}
      {tab === 'parcerias' && <BrandDeals />}
    </div>
  )
}

const STAGE_ORDER = ['lead', 'qualificado', 'proposta', 'convertido', 'perdido']
const STAGE_LABEL = {
  lead: 'Lead',
  qualificado: 'Qualificado',
  proposta: 'Proposta',
  convertido: 'Convertido',
  perdido: 'Perdido',
}

const EMPTY_LEAD = { id: null, name: '', contact: '', stage: 'lead', value: '', launch_name: '', notes: '' }

function LeadsFunnel() {
  const { user } = useAuth()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_LEAD)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('marketing_leads').select('*').order('created_at', { ascending: false })
    if (error) toast.error('Erro ao carregar leads')
    else setLeads(data)
    setLoading(false)
  }

  const stats = useMemo(() => {
    const total = leads.length
    const convertido = leads.filter((l) => l.stage === 'convertido').length
    const rate = total > 0 ? Math.round((convertido / total) * 100) : 0
    return { total, convertido, rate }
  }, [leads])

  function openNew() {
    setForm(EMPTY_LEAD)
    setShowModal(true)
  }

  function openEdit(l) {
    setForm({ ...l, value: l.value != null ? String(l.value) : '', contact: l.contact || '', launch_name: l.launch_name || '', notes: l.notes || '' })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      contact: form.contact.trim() || null,
      stage: form.stage,
      value: form.value ? Number(form.value) : null,
      launch_name: form.launch_name.trim() || null,
      notes: form.notes.trim() || null,
    }
    let error
    if (form.id) {
      ;({ error } = await supabase.from('marketing_leads').update(payload).eq('id', form.id))
    } else {
      ;({ error } = await supabase.from('marketing_leads').insert(payload))
    }
    if (error) toast.error('Erro ao salvar lead')
    else {
      toast.success('Salvo')
      setShowModal(false)
      load()
    }
    setSaving(false)
  }

  async function moveStage(lead, direction) {
    const idx = STAGE_ORDER.indexOf(lead.stage)
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= STAGE_ORDER.length) return
    const { error } = await supabase.from('marketing_leads').update({ stage: STAGE_ORDER[newIdx] }).eq('id', lead.id)
    if (error) toast.error('Erro ao mover')
    else load()
  }

  async function handleDelete(id) {
    if (!confirm('Excluir este lead?')) return
    const { error } = await supabase.from('marketing_leads').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir')
    else {
      toast.success('Excluído')
      load()
    }
  }

  const columns = useMemo(() => {
    const map = Object.fromEntries(STAGE_ORDER.map((s) => [s, []]))
    for (const l of leads) if (map[l.stage]) map[l.stage].push(l)
    return map
  }, [leads])

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-4 text-sm text-slate-600">
          <span><strong className="text-slate-900">{stats.total}</strong> leads</span>
          <span><strong className="text-slate-900">{stats.convertido}</strong> convertidos</span>
          <span><strong className="text-slate-900">{stats.rate}%</strong> conversão</span>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> Novo lead
        </button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGE_ORDER.map((stage) => (
            <div key={stage} className="w-56 shrink-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-medium text-slate-600">{STAGE_LABEL[stage]}</span>
                <span className="text-xs text-slate-400">{columns[stage].length}</span>
              </div>
              <div className="space-y-2">
                {columns[stage].map((lead) => (
                  <div key={lead.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-sm font-medium text-slate-900">{lead.name}</p>
                    {lead.value != null && <p className="text-xs text-slate-400">{formatCurrency(lead.value)}</p>}
                    {lead.launch_name && <p className="text-xs text-slate-400">{lead.launch_name}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex gap-0.5">
                        <button onClick={() => moveStage(lead, -1)} disabled={STAGE_ORDER.indexOf(lead.stage) === 0} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-20">
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => moveStage(lead, 1)} disabled={STAGE_ORDER.indexOf(lead.stage) === STAGE_ORDER.length - 1} className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-20">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex gap-0.5">
                        <button onClick={() => openEdit(lead)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(lead.id)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={form.id ? 'Editar lead' : 'Novo lead'}>
        <form id="lead-form" onSubmit={handleSave} className="space-y-4">
          <Field label="Nome"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" /></Field>
          <Field label="Contato"><input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className="input" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Estágio">
              <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} className="input">
                {STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
              </select>
            </Field>
            <Field label="Valor (opcional)">
              <input type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="input" />
            </Field>
          </div>
          <Field label="Lançamento/campanha"><input value={form.launch_name} onChange={(e) => setForm({ ...form, launch_name: e.target.value })} className="input" placeholder="Fluência Sem Medo - turma X" /></Field>
          <Field label="Notas"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" rows={2} /></Field>
        </form>
        <div className="mt-2 flex gap-2 pt-2">
          <button type="submit" form="lead-form" disabled={saving} className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

const EMPTY_POST = { id: null, scheduled_date: '', platform: 'instagram', theme: '', status: 'planned' }

function SocialPosts() {
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_POST)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('social_posts').select('*').order('scheduled_date', { ascending: true })
    if (error) toast.error('Erro ao carregar postagens')
    else setPosts(data)
    setLoading(false)
  }

  function openNew() {
    setForm(EMPTY_POST)
    setShowModal(true)
  }
  function openEdit(p) {
    setForm(p)
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      user_id: user.id,
      scheduled_date: form.scheduled_date,
      platform: form.platform,
      theme: form.theme.trim(),
      status: form.status,
    }
    let error
    if (form.id) {
      ;({ error } = await supabase.from('social_posts').update(payload).eq('id', form.id))
    } else {
      ;({ error } = await supabase.from('social_posts').insert(payload))
    }
    if (error) toast.error('Erro ao salvar')
    else {
      toast.success('Salvo')
      setShowModal(false)
      load()
    }
    setSaving(false)
  }

  async function toggleStatus(p) {
    const newStatus = p.status === 'planned' ? 'posted' : 'planned'
    const { error } = await supabase.from('social_posts').update({ status: newStatus }).eq('id', p.id)
    if (error) toast.error('Erro ao atualizar')
    else load()
  }

  async function handleDelete(id) {
    if (!confirm('Excluir esta postagem?')) return
    const { error } = await supabase.from('social_posts').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir')
    else {
      toast.success('Excluído')
      load()
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button onClick={openNew} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          <Plus className="h-4 w-4" /> Nova postagem
        </button>
      </div>
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-400">Nenhuma postagem planejada.</div>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{formatDate(p.scheduled_date)}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 capitalize">{p.platform}</span>
                  <button
                    onClick={() => toggleStatus(p)}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      p.status === 'posted' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {p.status === 'posted' ? 'Postado' : 'Planejado'}
                  </button>
                </div>
                <p className="mt-1 truncate text-sm text-slate-600">{p.theme}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => openEdit(p)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(p.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={form.id ? 'Editar postagem' : 'Nova postagem'}>
        <form id="post-form" onSubmit={handleSave} className="space-y-4">
          <Field label="Data"><input type="date" required value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} className="input" /></Field>
          <Field label="Plataforma">
            <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="input">
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="outro">Outro</option>
            </select>
          </Field>
          <Field label="Tema"><input required value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })} className="input" /></Field>
        </form>
        <div className="mt-2 flex gap-2 pt-2">
          <button type="submit" form="post-form" disabled={saving} className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </Modal>
    </div>
  )
}

const EMPTY_DEAL = { id: null, brand_name: '', status: 'contatado', value: '', contact_date: '', notes: '' }

function BrandDeals() {
  const { user } = useAuth()
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_DEAL)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('brand_deals').select('*').order('created_at', { ascending: false })
    if (error) toast.error('Erro ao carregar parcerias')
    else setDeals(data)
    setLoading(false)
  }

  function openNew() {
    setForm(EMPTY_DEAL)
    setShowModal(true)
  }
  function openEdit(d) {
    setForm({ ...d, value: d.value != null ? String(d.value) : '', notes: d.notes || '' })
    setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      user_id: user.id,
      brand_name: form.brand_name.trim(),
      status: form.status,
      value: form.value ? Number(form.value) : null,
      contact_date: form.contact_date || null,
      notes: form.notes.trim() || null,
    }
    let error
    if (form.id) {
      ;({ error } = await supabase.from('brand_deals').update(payload).eq('id', form.id))
    } else {
      ;({ error } = await supabase.from('brand_deals').insert(payload))
    }
    if (error) toast.error('Erro ao salvar')
    else {
      toast.success('Salvo')
      setShowModal(false)
      load()
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Excluir esta parceria?')) return
    const { error } = await supabase.from('brand_deals').delete().eq('id', id)
    if (error) toast.error('Erro ao excluir')
    else {
      toast.success('Excluído')
      load()
    }
  }

  const DEAL_STATUS = {
    contatado: { label: 'Contatado', className: 'bg-slate-100 text-slate-600' },
    negociando: { label: 'Negociando', className: 'bg-amber-50 text-amber-700' },
    fechado: { label: 'Fechado', className: 'bg-emerald-50 text-emerald-700' },
    recusado: { label: 'Recusado', className: 'bg-red-50 text-red-700' },
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button onClick={openNew} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          <Plus className="h-4 w-4" /> Nova parceria
        </button>
      </div>
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
      ) : deals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-400">Nenhuma marca cadastrada ainda.</div>
      ) : (
        <div className="space-y-2">
          {deals.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{d.brand_name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${DEAL_STATUS[d.status].className}`}>{DEAL_STATUS[d.status].label}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {d.value != null && formatCurrency(d.value)}
                  {d.contact_date && ` · contato em ${formatDate(d.contact_date)}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => openEdit(d)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(d.id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={form.id ? 'Editar parceria' : 'Nova parceria'}>
        <form id="deal-form" onSubmit={handleSave} className="space-y-4">
          <Field label="Marca"><input required value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} className="input" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">
                {Object.entries(DEAL_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            <Field label="Valor (opcional)">
              <input type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="input" />
            </Field>
          </div>
          <Field label="Data de contato"><input type="date" value={form.contact_date} onChange={(e) => setForm({ ...form, contact_date: e.target.value })} className="input" /></Field>
          <Field label="Notas"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" rows={2} /></Field>
        </form>
        <div className="mt-2 flex gap-2 pt-2">
          <button type="submit" form="deal-form" disabled={saving} className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
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
