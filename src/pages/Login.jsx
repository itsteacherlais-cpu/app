import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Mail, Lock, Sparkles } from 'lucide-react'

export default function Login() {
  const { user, loading, signInWithPassword, signInWithMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('password') // 'password' | 'magic'
  const [busy, setBusy] = useState(false)
  const [magicSent, setMagicSent] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      if (mode === 'password') {
        const { error } = await signInWithPassword(email, password)
        if (error) throw error
      } else {
        const { error } = await signInWithMagicLink(email)
        if (error) throw error
        setMagicSent(true)
        toast.success('Link mágico enviado! Confira seu e-mail.')
      }
    } catch (err) {
      toast.error(err.message || 'Erro ao entrar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Teacher Laís HQ</h1>
          <p className="mt-1 text-sm text-slate-500">Entre para gerenciar seu negócio</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">E-mail</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="voce@exemplo.com"
              />
            </div>
          </div>

          {mode === 'password' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Senha</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          {magicSent ? (
            <p className="rounded-lg bg-emerald-50 p-3 text-center text-sm text-emerald-700">
              Link enviado para {email}. Abra seu e-mail para entrar.
            </p>
          ) : (
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy ? 'Entrando…' : mode === 'password' ? 'Entrar' : 'Enviar link mágico'}
            </button>
          )}
        </form>

        <button
          onClick={() => {
            setMode(mode === 'password' ? 'magic' : 'password')
            setMagicSent(false)
          }}
          className="mt-4 w-full text-center text-xs font-medium text-indigo-600 hover:underline"
        >
          {mode === 'password' ? 'Entrar com link mágico (sem senha)' : 'Entrar com e-mail e senha'}
        </button>
      </div>
    </div>
  )
}
