import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { AlertTriangle, CheckCircle2, Circle } from 'lucide-react'
import { formatDate, CONTENT_STATUS } from '../lib/format'
import { isBefore } from 'date-fns'

const CHECKLIST_STEPS = [
  ['roteiro', 'Roteiro pronto'],
  ['gravado', 'Gravado'],
  ['editado', 'Editado'],
  ['thumbnail', 'Thumbnail'],
  ['legenda', 'Legenda escrita'],
  ['publicado', 'Publicado'],
]

const DEFAULT_CHECKLIST = Object.fromEntries(CHECKLIST_STEPS.map(([k]) => [k, false]))

export default function Production() {
  const { user } = useAuth()
  const [contentItems, setContentItems] = useState([])
  const [productionItems, setProductionItems] = useState({}) // content_item_id -> row
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const [{ data: content, error: contentErr }, { data: production, error: prodErr }] = await Promise.all([
      supabase.from('content_items').select('*').neq('status', 'published').order('planned_publish_date', { ascending: true, nullsFirst: false }),
      supabase.from('production_items').select('*'),
    ])
    if (contentErr || prodErr) toast.error('Erro ao carregar produção')
    setContentItems(content || [])
    setProductionItems(Object.fromEntries((production || []).map((p) => [p.content_item_id, p])))
    setLoading(false)
  }

  async function toggleStep(item, step) {
    const existing = productionItems[item.id]
    const checklist = { ...(existing?.checklist || DEFAULT_CHECKLIST), [step]: !existing?.checklist?.[step] }

    if (existing) {
      const { error } = await supabase.from('production_items').update({ checklist }).eq('id', existing.id)
      if (error) toast.error('Erro ao atualizar checklist')
      else load()
    } else {
      const { error } = await supabase.from('production_items').insert({
        user_id: user.id,
        content_item_id: item.id,
        checklist,
      })
      if (error) toast.error('Erro ao atualizar checklist')
      else load()
    }
  }

  async function setDueDate(item, dueDate) {
    const existing = productionItems[item.id]
    if (existing) {
      const { error } = await supabase.from('production_items').update({ due_date: dueDate || null }).eq('id', existing.id)
      if (error) toast.error('Erro ao salvar prazo')
      else load()
    } else {
      const { error } = await supabase.from('production_items').insert({
        user_id: user.id,
        content_item_id: item.id,
        checklist: DEFAULT_CHECKLIST,
        due_date: dueDate || null,
      })
      if (error) toast.error('Erro ao salvar prazo')
      else load()
    }
  }

  const rows = useMemo(
    () =>
      contentItems.map((item) => {
        const production = productionItems[item.id]
        const checklist = production?.checklist || DEFAULT_CHECKLIST
        const doneCount = CHECKLIST_STEPS.filter(([k]) => checklist[k]).length
        const overdue = production?.due_date && isBefore(new Date(production.due_date), new Date()) && doneCount < CHECKLIST_STEPS.length
        return { item, production, checklist, doneCount, overdue }
      }),
    [contentItems, productionItems]
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Produção & Edição</h1>
      <p className="mb-5 text-sm text-slate-500">Checklist técnico dos vídeos em andamento (crie novos itens pelo Conteúdo)</p>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-400">
          Nenhum conteúdo em produção no momento.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(({ item, checklist, doneCount, overdue, production }) => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CONTENT_STATUS[item.status].className}`}>
                      {CONTENT_STATUS[item.status].label}
                    </span>
                    <span className="text-xs text-slate-400">{doneCount}/{CHECKLIST_STEPS.length}</span>
                    {overdue && (
                      <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                        <AlertTriangle className="h-3 w-3" /> atrasado
                      </span>
                    )}
                  </div>
                </div>
                <label className="text-right text-xs text-slate-400">
                  Prazo
                  <input
                    type="date"
                    value={production?.due_date || ''}
                    onChange={(e) => setDueDate(item, e.target.value)}
                    className="mt-0.5 block rounded-lg border border-slate-300 px-2 py-1 text-xs"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {CHECKLIST_STEPS.map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => toggleStep(item, key)}
                    className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs font-medium ${
                      checklist[key] ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'
                    }`}
                  >
                    {checklist[key] ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <Circle className="h-3.5 w-3.5 shrink-0" />}
                    {label}
                  </button>
                ))}
              </div>
              {item.planned_publish_date && (
                <p className="mt-2 text-xs text-slate-400">Publicação prevista: {formatDate(item.planned_publish_date)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
