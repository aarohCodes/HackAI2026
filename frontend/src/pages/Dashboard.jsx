import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Sidebar } from '../components/ui/Sidebar'
import { useStore } from '../store/useStore'
import { useGamification } from '../hooks/useGamification'
import { api } from '../api/client'
import {
  Sparkles, AlertTriangle, ChevronRight, Edit3,
  Brain, TrendingUp, Flame, Clock, Search, Plus, ArrowRight, Loader,
} from 'lucide-react'

const STATE_COLORS = {
  green: '#10B981',
  yellow: '#F59E0B',
  red: '#EF4444',
  fading: '#6B7280',
  glow: '#8B5CF6',
}

const CONCEPT_ICONS = {
  machine_learning: Brain,
  data_science: TrendingUp,
  default: Sparkles,
}

const QUICK_TOPICS = [
  { label: 'Machine Learning', icon: Brain, color: '#8B5CF6' },
  { label: 'Data Science', icon: TrendingUp, color: '#06B6D4' },
  { label: 'Web Development', icon: Sparkles, color: '#2DD4BF' },
  { label: 'Deep Learning', icon: Brain, color: '#F59E0B' },
]

export function DashboardPage() {
  const navigate = useNavigate()
  const { user, sidebarOpen, gamification, fetchGraph, invalidateGraph } = useStore()
  const [nodes, setNodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [topicInput, setTopicInput] = useState('')
  const [addingTopic, setAddingTopic] = useState(false)
  const [topicSuccess, setTopicSuccess] = useState(null)

  useGamification()

  useEffect(() => {
    if (!user) return
    fetchGraph().then(({ nodes: n }) => {
      setNodes(n)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user])

  const handleAddTopic = async (topic) => {
    const t = topic || topicInput.trim()
    if (!t || addingTopic) return
    setAddingTopic(true)
    setTopicSuccess(null)
    try {
      const res = await api.post('/graph/add-topic', { topic: t })
      setTopicSuccess(`Added ${res.data.nodes_created} concepts for "${t}"`)
      setTopicInput('')
      // Refresh graph cache
      invalidateGraph()
      const { nodes: refreshed } = await fetchGraph(true)
      setNodes(refreshed)
    } catch (err) {
      console.error('Failed to add topic:', err)
      setTopicSuccess('Failed to add topic. Please try again.')
    }
    setAddingTopic(false)
    setTimeout(() => setTopicSuccess(null), 4000)
  }

  const topConcepts = nodes
    .filter((n) => n.state !== 'red')
    .sort((a, b) => (b.retention_rt || 0) - (a.retention_rt || 0))
    .slice(0, 6)

  const gaps = nodes
    .filter((n) => n.state === 'fading' || n.state === 'red')
    .sort((a, b) => (a.retention_rt || 0) - (b.retention_rt || 0))
    .slice(0, 4)

  const greetingTime = new Date().getHours()
  const greeting = greetingTime < 12 ? 'Good morning' : greetingTime < 18 ? 'Good afternoon' : 'Good evening'

  const proficiencyLabel = (r) => {
    if (r >= 0.85) return 'Mastered'
    if (r >= 0.7) return 'Proficient'
    if (r >= 0.5) return 'Developing'
    return 'Needs Review'
  }

  return (
    <div className="min-h-screen bg-cogni-bg">
      <Sidebar />
      <div
        className="transition-all duration-300 p-8"
        style={{ marginLeft: sidebarOpen ? 224 : 72 }}
      >
        <div className="max-w-5xl mx-auto">
          {/* Greeting */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-8"
          >
            <h1 className="font-display text-3xl font-extrabold">
              {greeting},{' '}
              <span className="text-white/60">{user?.name || 'Learner'}.</span>{' '}
              <span className="bg-gradient-to-r from-cogni-accent to-cogni-teal bg-clip-text text-transparent">
                Good to see you back.
              </span>
            </h1>
            <div className="flex items-center gap-4 mt-3">
              {gamification.streakDays > 0 && (
                <span className="flex items-center gap-1.5 text-sm text-cogni-warning">
                  <Flame size={16} /> {gamification.streakDays} day streak
                </span>
              )}
              <span className="text-sm text-white/30">
                Level {gamification.level} {gamification.levelTitle}
              </span>
            </div>
          </motion.div>

          {/* Start New Topic */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-10"
          >
            <div className="flex items-center gap-2 mb-4">
              <Plus size={18} className="text-cogni-teal" />
              <h2 className="font-display text-xl font-bold">What do you want to learn today?</h2>
            </div>

            <div className="flex gap-3 mb-4">
              <div className="flex-1 flex items-center bg-cogni-card border border-cogni-border rounded-2xl px-4 py-3 gap-3">
                <Search size={18} className="text-white/30 flex-shrink-0" />
                <input
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTopic()}
                  placeholder="Search for a new topic, skill, or concept..."
                  className="flex-1 bg-transparent text-white placeholder-white/30 outline-none"
                  disabled={addingTopic}
                />
              </div>
              <button
                onClick={() => handleAddTopic()}
                disabled={!topicInput.trim() || addingTopic}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cogni-accent to-cogni-teal text-white font-semibold text-sm flex items-center gap-2 disabled:opacity-30 hover:shadow-lg hover:shadow-cogni-accent/20 transition-all"
              >
                {addingTopic ? (
                  <>
                    <Loader size={16} className="animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <ArrowRight size={16} /> Start Learning
                  </>
                )}
              </button>
            </div>

            {/* Quick topic pills */}
            <div className="flex flex-wrap gap-2">
              {QUICK_TOPICS.map(({ label, icon: Icon, color }) => (
                <button
                  key={label}
                  onClick={() => handleAddTopic(label)}
                  disabled={addingTopic}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06] transition-all disabled:opacity-30"
                >
                  <Icon size={14} style={{ color }} />
                  <span className="text-sm text-white/60">{label}</span>
                </button>
              ))}
            </div>

            {/* Success/error message */}
            {topicSuccess && (
              <motion.div
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className={`mt-3 px-4 py-2.5 rounded-xl text-sm font-medium ${
                  topicSuccess.startsWith('Failed')
                    ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                    : 'bg-cogni-teal/10 border border-cogni-teal/20 text-cogni-teal'
                }`}
              >
                {topicSuccess}
              </motion.div>
            )}
          </motion.div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-4 mb-10">
            {[
              { label: 'Total Concepts', value: nodes.length, color: '#8B5CF6' },
              { label: 'Mastered', value: nodes.filter((n) => n.state === 'green').length, color: '#10B981' },
              { label: 'In Progress', value: nodes.filter((n) => n.state === 'yellow').length, color: '#F59E0B' },
              { label: 'Needs Review', value: nodes.filter((n) => n.state === 'red' || n.state === 'fading').length, color: '#EF4444' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 + i * 0.08 }}
                className="cogni-card"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: stat.color }}>
                  {stat.label}
                </p>
                <p className="text-3xl font-display font-extrabold mt-2">{stat.value}</p>
              </motion.div>
            ))}
          </div>

          {/* Current Knowledge */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="mb-10"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-bold">Current Knowledge</h2>
              <button
                onClick={() => navigate('/hubs')}
                className="text-sm text-cogni-accent flex items-center gap-1 hover:text-cogni-accent-light transition-colors"
              >
                View All <ChevronRight size={14} />
              </button>
            </div>

            {loading ? (
              <div className="flex gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex-1 h-28 rounded-2xl bg-cogni-card animate-pulse" />
                ))}
              </div>
            ) : topConcepts.length === 0 ? (
              <div className="cogni-card text-center py-8">
                <Brain size={32} className="text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">No concepts yet. Start a new topic above to build your knowledge graph!</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {topConcepts.map((node, i) => {
                  const color = STATE_COLORS[node.state] || '#8B5CF6'
                  const Icon = CONCEPT_ICONS[node.domain] || CONCEPT_ICONS.default
                  return (
                    <motion.div
                      key={node.id}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 + i * 0.06 }}
                      onClick={() => navigate('/canvas')}
                      className="cogni-card-hover cursor-pointer group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: `${color}15` }}
                          >
                            <Icon size={20} style={{ color }} />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{node.concept}</p>
                            <p className="text-[10px] text-white/40 capitalize">{node.domain?.replace(/_/g, ' ')}</p>
                          </div>
                        </div>
                        <Edit3 size={14} className="text-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium" style={{ color }}>
                          {proficiencyLabel(node.retention_rt)}
                        </span>
                        <span className="text-xs text-white/40">{Math.round((node.retention_rt || 0) * 100)}%</span>
                      </div>
                      <div className="mt-2 cogni-progress-bar">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.round((node.retention_rt || 0) * 100)}%`,
                            background: `linear-gradient(to right, ${color}, ${color}80)`,
                          }}
                        />
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.div>

          {/* Gaps Detected */}
          {gaps.length > 0 && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="mb-10"
            >
              <div className="flex items-center gap-2 mb-5">
                <AlertTriangle size={18} className="text-cogni-warning" />
                <h2 className="font-display text-xl font-bold">Gaps Detected</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {gaps.map((node, i) => (
                  <motion.div
                    key={node.id}
                    initial={{ y: 15, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 + i * 0.06 }}
                    onClick={() => navigate('/canvas')}
                    className="p-4 rounded-2xl border cursor-pointer transition-all hover:scale-[1.01]"
                    style={{
                      borderColor: node.state === 'fading' ? 'rgba(107,114,128,0.3)' : 'rgba(239,68,68,0.2)',
                      background: node.state === 'fading' ? 'rgba(107,114,128,0.05)' : 'rgba(239,68,68,0.05)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ background: node.state === 'fading' ? '#6B7280' : '#EF4444' }}
                        />
                        <div>
                          <p className="font-semibold text-sm">{node.concept}</p>
                          <p className="text-[10px] text-white/30 mt-0.5 flex items-center gap-1">
                            <Clock size={9} />
                            {node.state === 'fading' ? 'Decaying — review soon' : 'Needs review'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold" style={{ color: STATE_COLORS[node.state] }}>
                        {Math.round((node.retention_rt || 0) * 100)}%
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Bottom action */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center"
          >
            <button
              onClick={() => navigate('/metrics')}
              className="cogni-btn-secondary inline-flex items-center gap-2"
            >
              <TrendingUp size={16} className="text-cogni-accent" />
              Adjust Model
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
