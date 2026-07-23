import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Settings as SettingsIcon } from 'lucide-react'

export default function Settings() {
  const { user } = useAuth()
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('settings').select('*').maybeSingle()
    if (error) toast.error('Erro ao carregar configurações')
    else if (data) {
      setForm({
        mei_annual_limit: String(data.mei_annual_limit),
        mei_tolerance_pct: String(data.mei_tolerance_pct),
        mei_alert_thresholds: (data.mei_alert_thresholds || [70, 85, 95]).join(', '),
      })
    }
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const thresholds = form.mei_alert_thresholds
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n) && n > 0)
      .sort((a, b) => a - b)

    const { error } = await supabase
      .from('settings')
      .update({
        mei_annual_limit: Number(form.mei_annual_limit),
        mei_tolerance_pct: Number(form.mei_tolerance_pct),
        mei_alert_thresholds: thresholds,
      })
      .eq('user_id', user.id)

    if (error) toast.error('Erro ao salvar')
    else toast.success('Configurações salvas')
    setSaving(false)
  }

  if (loading || !form) {
    return <p className="py-10 text-center text-sm text-slate-400">Carregando…</p>
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-1 flex items-center gap-2 text-xl font-semibold text-slate-900">
        <SettingsIcon className="h-5 w-5 text-slate-400" /> Configurações
      </h1>
      <p className="mb-6 text-sm text-slate-500">Ajustes do limite de faturamento do MEI</p>

      <form onSubmit={handleSave} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <Field label="Limite anual do MEI (R$)">
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={form.mei_annual_limit}
            onChange={(e) => setForm({ ...form, mei_annual_limit: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Tolerância acima do limite (%)">
          <input
            type="number"
            min="0"
            step="0.1"
            required
            value={form.mei_tolerance_pct}
            onChange={(e) => setForm({ ...form, mei_tolerance_pct: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Avisar nos seguintes patamares (%, separados por vírgula)">
          <input
            required
            value={form.mei_alert_thresholds}
            onChange={(e) => setForm({ ...form, mei_alert_thresholds: e.target.value })}
            className="input"
            placeholder="70, 85, 95"
          />
        </Field>
        <p className="text-xs text-slate-400">
          Esses valores seguem a legislação atual do MEI (R$ 81.000/ano + 20% de tolerância em 2026). Como a lei pode
          mudar, você pode ajustar aqui a qualquer momento.
        </p>
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </form>
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
