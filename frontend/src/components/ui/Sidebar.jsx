import { useStore } from '../../store/useStore'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Brain, ChevronLeft, ChevronRight, Network,
} from 'lucide-react'

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useStore()
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = location.pathname === '/' || location.pathname === '/canvas'

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
          onClick={() => navigate('/canvas')}
        >
          <Brain size={18} className="text-white" />
        </div>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="cursor-pointer"
            onClick={() => navigate('/canvas')}
          >
            <span className="font-display font-bold text-lg tracking-tight">CogniPath</span>
            <p className="text-[9px] font-bold uppercase tracking-wider text-cogni-teal -mt-0.5">Adaptive Learning</p>
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 mt-4 space-y-1">
        <button
          onClick={() => navigate('/canvas')}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer
            ${isActive
              ? 'text-white bg-cogni-accent/20 border border-cogni-accent/30'
              : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'}
          `}
        >
          <Network size={20} className="flex-shrink-0" />
          {sidebarOpen && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              Knowledge Graph
            </motion.span>
          )}
        </button>
      </nav>

      <button
        onClick={toggleSidebar}
        className="mx-auto mb-4 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
      >
        {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>
    </motion.aside>
  )
}
