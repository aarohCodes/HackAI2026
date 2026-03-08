import { useStore } from '../../store/useStore'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Map, BarChart3, Award, CheckSquare, Brain,
  ChevronLeft, ChevronRight, Flame, LogOut, Settings,
} from 'lucide-react'
import { DailyGoalRing } from '../gamification/DailyGoalRing'

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { key: 'hubs', label: 'Hubs', icon: Map, path: '/hubs' },
  { key: 'assess', label: 'Tasks', icon: CheckSquare, path: '/assess' },
  { key: 'metrics', label: 'Insights', icon: BarChart3, path: '/metrics' },
]

export function Sidebar() {
  const { user, gamification, sidebarOpen, toggleSidebar, logout } = useStore()
  const navigate = useNavigate()
  const location = useLocation()

  const currentPath = location.pathname

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarOpen ? 224 : 72 }}
      className="fixed left-0 top-0 h-screen bg-cogni-card/60 backdrop-blur-xl border-r border-cogni-border z-50 flex flex-col"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-2">
        <div
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-cogni-accent to-cogni-teal flex items-center justify-center flex-shrink-0 cursor-pointer"
          onClick={() => navigate('/dashboard')}
        >
          <Brain size={18} className="text-white" />
        </div>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="cursor-pointer"
            onClick={() => navigate('/dashboard')}
          >
            <span className="font-display font-bold text-lg tracking-tight">CogniPath</span>
            <p className="text-[9px] font-bold uppercase tracking-wider text-cogni-teal -mt-0.5">Global Hub</p>
          </motion.div>
        )}
      </div>

      {/* User card */}
      {user && sidebarOpen && (
        <div className="mx-3 mt-4 mb-2 p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cogni-accent to-cogni-cyan flex items-center justify-center text-sm font-bold flex-shrink-0">
              {user.name?.[0] || 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user.name}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-cogni-accent">
                Level {gamification.level} {gamification.levelTitle}
              </p>
            </div>
          </div>
          {gamification.streakDays > 0 && (
            <div className="flex items-center gap-1.5 mt-2 text-xs text-cogni-warning">
              <Flame size={14} />
              <span className="font-semibold">{gamification.streakDays} day streak</span>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 mt-2 space-y-1">
        {NAV_ITEMS.map(({ key, label, icon: Icon, path }) => {
          const isActive = currentPath === path
          return (
            <button
              key={key}
              onClick={() => navigate(path)}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer
                ${isActive
                  ? 'text-white bg-cogni-accent/20 border border-cogni-accent/30'
                  : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'}
              `}
            >
              <Icon size={20} className="flex-shrink-0" />
              {sidebarOpen && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {label}
                </motion.span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Daily goal */}
      {sidebarOpen && (
        <div className="px-3 pb-3">
          <DailyGoalRing
            current={gamification.dailyXp}
            goal={gamification.dailyXpGoal}
          />
        </div>
      )}

      {/* Logout + Collapse toggle */}
      <div className="px-3 pb-2 space-y-1">
        {sidebarOpen && (
          <button
            onClick={() => {
              logout()
              navigate('/')
            }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-white/40 hover:text-cogni-danger hover:bg-cogni-danger/10 border border-transparent transition-all"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        )}
      </div>

      <button
        onClick={toggleSidebar}
        className="mx-auto mb-4 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
      >
        {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>
    </motion.aside>
  )
}
