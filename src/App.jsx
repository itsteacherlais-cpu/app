import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Students = lazy(() => import('./pages/Students'))
const Calendar = lazy(() => import('./pages/Calendar'))
const Payments = lazy(() => import('./pages/Payments'))
const Content = lazy(() => import('./pages/Content'))
const Finance = lazy(() => import('./pages/Finance'))
const Marketing = lazy(() => import('./pages/Marketing'))
const Production = lazy(() => import('./pages/Production'))
const Settings = lazy(() => import('./pages/Settings'))

function PageFallback() {
  return (
    <div className="flex h-full items-center justify-center py-20 text-sm text-slate-400">
      Carregando…
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/alunos" element={<Students />} />
              <Route path="/calendario" element={<Calendar />} />
              <Route path="/pagamentos" element={<Payments />} />
              <Route path="/conteudo" element={<Content />} />
              <Route path="/financeiro" element={<Finance />} />
              <Route path="/marketing" element={<Marketing />} />
              <Route path="/producao" element={<Production />} />
              <Route path="/configuracoes" element={<Settings />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
