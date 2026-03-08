import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sidebar } from '../components/ui/Sidebar'
import { useStore } from '../store/useStore'
import { useGamification } from '../hooks/useGamification'
import { api } from '../api/client'
import {
  Sparkles, HelpCircle, Mic, Zap,
  ChevronRight, Award, Clock, CheckCircle, Brain
} from 'lucide-react'

function formatDomain(d) {
  return (d || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function AssessmentPage() {
  const navigate = useNavigate()
  const { user, sidebarOpen, gamification, graphNodes, fetchGraph } = useStore()
  const [nodes, setNodes] = useState([])
  const [focalPoints, setFocalPoints] = useState([])
  const [readinessScore, setReadinessScore] = useState(0)
  const [domains, setDomains] = useState([])
  const [selectedDomain, setSelectedDomain] = useState(null)
  const [quizHub, setQuizHub] = useState(null)
  const [quizSubTopic, setQuizSubTopic] = useState(null)
  const [quizCustomTopic, setQuizCustomTopic] = useState('')

  useGamification()

  useEffect(() => {
    const load = async () => {
      const { nodes: n } = await fetchGraph()
      if (!n.length) return
      setNodes(n)

      const green = n.filter((node) => node.state === 'green').length
      const total = n.length
      setReadinessScore(total > 0 ? Math.round((green / total) * 100) : 0)

      const uniqueDomains = [...new Set(n.map((node) => node.domain).filter(Boolean))]
      setDomains(uniqueDomains)

      const weak = n
        .filter((node) => ['fading', 'yellow', 'red'].includes(node.state))
        .sort((a, b) => (a.retention_rt || 0) - (b.retention_rt || 0))
        .slice(0, 3)

      const tags = ['HIGH IMPACT', 'FAST TRACK', 'MASTERY CLOSE']
      const colors = ['#8B5CF6', '#06B6D4', '#2DD4BF']
      setFocalPoints(
        weak.map((node, i) => ({
          tag: tags[i] || 'FOCUS',
          label: node.concept,
          color: colors[i] || '#8B5CF6',
          mastery: node.mastery_score || 0,
        }))
      )
    }
    load()
  }, [])

  const assessmentModes = [
    {
      title: 'Scenario Generator',
      desc: 'AI-generated real-world problems based on your learning data. Gemini builds a multi-step case study.',
      icon: Sparkles,
      color: '#8B5CF6',
      action: 'START SIMULATION',
      path: '/assess/scenario',
    },
    {
      title: 'Adaptive Quiz',
      desc: '10 AI-generated questions across your knowledge graph — multiple choice, true/false, fill-blank, and more.',
      icon: Brain,
      color: '#06B6D4',
      action: 'LAUNCH QUIZ',
      path: '/assess/quiz',
    },
    {
      title: 'Rapid Drill',
      desc: '15 rapid-fire questions with a countdown timer. Tests recall speed on your weakest concepts.',
      icon: Zap,
      color: '#F59E0B',
      action: 'START DRILLS',
      path: '/assess/drill',
    },
  ]

  const readinessLabel = readinessScore >= 80 ? 'Advanced' : readinessScore >= 50 ? 'Intermediate' : 'Building'

  return (
    <div className="min-h-screen bg-cogni-bg">
      <Sidebar />
      <div
        className="transition-all duration-300 p-8"
        style={{ marginLeft: sidebarOpen ? 224 : 72 }}
      >
        <div className="max-w-5xl mx-auto">
          {/* Header with readiness score */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-3xl font-black">
                <span className="cogni-gradient-text">Mastery Assessment</span>
              </h1>
              <p className="text-white/40 mt-2 max-w-lg">
                Challenge your knowledge with AI-generated assessments. Every quiz, scenario, and drill is
                crafted by Gemini based on your personal knowledge graph.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20">
                <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                  <circle
                    cx="40" cy="40" r="34" fill="none"
                    stroke="url(#readinessGrad)" strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={`${(readinessScore / 100) * 213.6} 213.6`}
                  />
                  <defs>
                    <linearGradient id="readinessGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#8B5CF6" />
                      <stop offset="100%" stopColor="#2DD4BF" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-black">{readinessScore}%</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Readiness Score</p>
                <p className="font-bold text-cogni-teal">{readinessLabel} Level</p>
              </div>
            </div>
          </div>

          {/* Topic selector for Scenario / general */}
          {domains.length > 0 && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05 }} className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 mb-3">
                Focus for Scenario (optional)
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedDomain(null)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                    !selectedDomain ? 'border-cogni-accent/50 bg-cogni-accent/15 text-cogni-accent' : 'border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20'
                  }`}
                >
                  All Topics
                </button>
                {domains.map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelectedDomain(d)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                      selectedDomain === d ? 'border-cogni-accent/50 bg-cogni-accent/15 text-cogni-accent' : 'border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20'
                    }`}
                  >
                    {formatDomain(d)}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Assessment mode cards */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {assessmentModes.map((mode, i) => (
              <motion.div
                key={mode.title}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                className="cogni-card-hover flex flex-col"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${mode.color}15` }}>
                    <mode.icon size={22} style={{ color: mode.color }} />
                  </div>
                  <h3 className="font-bold">{mode.title}</h3>
                </div>
                <p className="text-sm text-white/50 flex-1 mb-4">{mode.desc}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-white/25 mb-3">
                  <Sparkles size={10} /> Powered by Gemini
                </div>
                {mode.path === '/assess/quiz' ? (
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Quiz topic</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      <button
                        type="button"
                        onClick={() => { setQuizHub(null); setQuizSubTopic(null); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                          !quizHub ? 'border-cogni-accent/50 bg-cogni-accent/15 text-cogni-accent' : 'border-white/10 text-white/50'
                        }`}
                      >
                        All
                      </button>
                      {domains.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => { setQuizHub(d); setQuizSubTopic(null); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                            quizHub === d ? 'border-cogni-accent/50 bg-cogni-accent/15 text-cogni-accent' : 'border-white/10 text-white/50'
                          }`}
                        >
                          {formatDomain(d)}
                        </button>
                      ))}
                    </div>
                    {quizHub && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <button
                          type="button"
                          onClick={() => setQuizSubTopic('__all_hub__')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                            quizSubTopic === '__all_hub__' ? 'border-cogni-teal/50 bg-cogni-teal/15 text-cogni-teal' : 'border-white/10 text-white/50'
                          }`}
                        >
                          Full hub
                        </button>
                        {nodes.filter((n) => n.domain === quizHub).map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => setQuizSubTopic(n.concept)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border truncate max-w-[140px] ${
                              quizSubTopic === n.concept ? 'border-cogni-teal/50 bg-cogni-teal/15 text-cogni-teal' : 'border-white/10 text-white/50'
                            }`}
                          >
                            {n.concept}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={quizCustomTopic}
                        onChange={(e) => setQuizCustomTopic(e.target.value)}
                        placeholder="Or type custom topic..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-cogni-accent/40"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const topic = quizCustomTopic.trim() || (quizSubTopic === '__all_hub__' ? formatDomain(quizHub) : quizSubTopic) || (quizHub ? formatDomain(quizHub) : null)
                        navigate(topic ? `/assess/quiz?topic=${encodeURIComponent(topic)}` : '/assess/quiz')
                      }}
                      className="flex items-center gap-2 text-sm font-bold transition-colors cursor-pointer mt-2"
                      style={{ color: mode.color }}
                    >
                      {mode.action} <ChevronRight size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      const params = selectedDomain ? `?topic=${encodeURIComponent(formatDomain(selectedDomain))}` : ''
                      navigate(mode.path + params)
                    }}
                    className="flex items-center gap-2 text-sm font-bold transition-colors cursor-pointer"
                    style={{ color: mode.color }}
                  >
                    {mode.action} <ChevronRight size={14} />
                  </button>
                )}
              </motion.div>
            ))}
          </div>

          {/* Focal Points */}
          {focalPoints.length > 0 && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="cogni-card mb-8"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Recommended Focal Points</h3>
                <span className="text-xs text-white/25">Based on your knowledge graph</span>
              </div>
              <div className="flex gap-3">
                {focalPoints.map(({ tag, label, color, mastery }) => (
                  <button
                    key={label}
                    onClick={() => navigate(`/assess/scenario?concept=${encodeURIComponent(label)}`)}
                    className="flex-1 p-3 rounded-xl border transition-all hover:scale-[1.02] cursor-pointer"
                    style={{ borderColor: `${color}30`, background: `${color}08` }}
                  >
                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color }}>
                      {tag}
                    </p>
                    <p className="text-sm font-semibold mt-1">{label}</p>
                    <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${mastery * 100}%`, background: color }} />
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* How it works */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="cogni-card border-dashed border-white/10"
          >
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <Sparkles size={16} className="text-cogni-accent" />
              How Assessment Works
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-bold text-cogni-accent mb-1">1. AI Generation</p>
                <p className="text-xs text-white/40">Gemini analyzes your knowledge graph and generates unique questions tailored to your gaps.</p>
              </div>
              <div>
                <p className="text-xs font-bold text-cogni-teal mb-1">2. Adaptive Difficulty</p>
                <p className="text-xs text-white/40">Questions focus on weak concepts (red/fading nodes) while reinforcing strong ones.</p>
              </div>
              <div>
                <p className="text-xs font-bold text-cogni-warning mb-1">3. Graph Updates</p>
                <p className="text-xs text-white/40">Strong quiz scores boost mastery and can promote nodes from red to yellow to green.</p>
              </div>
            </div>
          </motion.div>

          <div className="mt-12 pt-6 border-t border-white/5 flex justify-center gap-8 text-xs text-white/20">
            <span>PRIVACY</span>
            <span>DOCUMENTATION</span>
            <span>SUPPORT</span>
          </div>
        </div>
      </div>
    </div>
  )
}
