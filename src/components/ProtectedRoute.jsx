import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400">
        Carregando…
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return children
}
