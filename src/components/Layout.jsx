import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { syncStudyPlanTasks } from '../lib/studyPlanTasks'
import Modal from './Modal'
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Wallet,
  LogOut,
  Grid2x2,
  Clapperboard,
  Landmark,
  Megaphone,
  Film,
  Settings as SettingsIcon,
  ListTodo,
  Timer,
  Trophy,
} from 'lucide-react'

const PRIMARY_ITEMS = [
  { to: '/', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/alunos', label: 'Alunos', icon: Users },
  { to: '/calendario', label: 'Aulas', icon: CalendarDays },
  { to: '/pagamentos', label: 'Pagamentos', icon: Wallet },
]

// Seções adicionais: cabem todas no menu lateral do desktop, e no mobile
// ficam agrupadas atrás do botão "Mais" pra não lotar a barra inferior.
const SECONDARY_ITEMS = [
  { to: '/conteudo', label: 'Conteúdo', icon: Clapperboard },
  { to: '/financeiro', label: 'Financeiro', icon: Landmark },
  { to: '/marketing', label: 'Marketing', icon: Megaphone },
  { to: '/producao', label: 'Produção', icon: Film },
  { to: '/tarefas', label: 'Tarefas', icon: ListTodo },
  { to: '/ponto', label: 'Controle de Ponto', icon: Timer },
  { to: '/conquistas', label: 'Conquistas', icon: Trophy },
  { to: '/configuracoes', label: 'Configurações', icon: SettingsIcon },
]

export default function Layout() {
  const { signOut, user } = useAuth()
  const location = useLocation()
  const [showMore, setShowMore] = useState(false)

  const isSecondaryActive = SECONDARY_ITEMS.some((item) => location.pathname === item.to)

  useEffect(() => {
    if (user) syncStudyPlanTasks(user.id)
  }, [user])

  return (
    <div className="flex h-screen flex-col bg-slate-50 md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="px-5 py-6">
          <p className="text-lg font-semibold text-slate-900">Teacher Laís HQ</p>
          <p className="text-xs text-slate-400">gestão do negócio</p>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {[...PRIMARY_ITEMS, ...SECONDARY_ITEMS].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => signOut()}
          className="m-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
        >
          <LogOut className="h-5 w-5" />
          Sair
        </button>
      </aside>

      {/* Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="safe-top flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white md:hidden">
          {PRIMARY_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                  isActive ? 'text-indigo-600' : 'text-slate-400'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
          <button
            onClick={() => setShowMore(true)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
              isSecondaryActive ? 'text-indigo-600' : 'text-slate-400'
            }`}
          >
            <Grid2x2 className="h-5 w-5" />
            Mais
          </button>
        </nav>
      </div>

      <Modal open={showMore} onClose={() => setShowMore(false)} title="Mais">
        <div className="space-y-1">
          {SECONDARY_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setShowMore(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </Modal>
    </div>
  )
}
