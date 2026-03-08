import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../store/useStore'
import { api, storeUser } from '../api/client'
import { Search, ArrowRight, Brain, Command, BookOpen, Target, Sparkles } from 'lucide-react'

const POPULAR_SUGGESTIONS = [
  { label: 'Machine Learning', icon: '🧠', color: '#8B5CF6' },
  { label: 'Financial Modeling', icon: '🏛️', color: '#F59E0B' },
  { label: 'React Development', icon: '⚛️', color: '#06B6D4' },
  { label: 'UI/UX Design', icon: '🎨', color: '#2DD4BF' },
]

const FEATURED_PATHS = [
  { title: 'Data Science', subtitle: 'Python, SQL, Statistics', gradient: 'from-cogni-accent/40 to-cogni-teal/20' },
  { title: 'Full Stack Web', subtitle: 'Next.js, Node, PostgreSQL', gradient: 'from-cogni-cyan/40 to-cogni-accent/20' },
]

const LEARNER_TYPES = [
  { value: 'consistent', label: 'Consistent', desc: 'A little every day', icon: '📚' },
  { value: 'gradual', label: 'Gradual', desc: 'Steady weekly pace', icon: '📈' },
  { value: 'binge', label: 'Binge', desc: 'Deep focused bursts', icon: '⚡' },
]

const STEP_LABELS = ['Goal Setting', 'Background', 'Launch']

export function Onboarding() {
  const navigate = useNavigate()
  const { user, setUser, invalidateGraph } = useStore()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    goal: '',
    background: '',
    prior_history: '',
    learner_type: 'gradual',
  })

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await api.post('/users/onboard', form)
      const updatedUser = { ...user, ...res.data.user, has_onboarded: true }
      storeUser(updatedUser)
      setUser(updatedUser)
      invalidateGraph()
      navigate('/canvas')
    } catch (err) {
      console.error('Onboarding failed:', err)
      setLoading(false)
    }
  }

  const pct = Math.round(((step + 1) / 3) * 100)

  return (
    <div className="min-h-screen bg-cogni-bg flex flex-col">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-cogni-accent/[0.06] rounded-full blur-[120px]" />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cogni-accent to-cogni-teal flex items-center justify-center">
            <Brain size={20} className="text-white" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight">CogniPath</span>
        </div>
        <button
          onClick={() => navigate('/canvas')}
          className="text-sm text-white/40 hover:text-white transition-colors px-4 py-2 rounded-xl border border-white/10 hover:border-white/20"
        >
          Skip
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center px-6 pt-8 pb-12 max-w-2xl mx-auto w-full">
        {/* Progress */}
        <div className="w-full mb-10">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-cogni-accent">
                Step {step + 1} of 3
              </p>
              <p className="text-sm text-white/40">{STEP_LABELS[step]}</p>
            </div>
            <p className="text-sm text-white/40">{pct}% Complete</p>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-cogni-accent to-cogni-teal"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 0: What do you want to learn */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="w-full"
            >
              <h1 className="font-display font-extrabold text-4xl md:text-5xl text-center">
                What do you want to{' '}
                <span className="bg-gradient-to-r from-cogni-accent to-cogni-teal bg-clip-text text-transparent">
                  learn
                </span>
                ?
              </h1>
              <p className="text-center text-white/40 mt-3 text-lg">
                Tell us your interests and we'll build a personalized learning path just for you.
              </p>

              {/* Search input */}
              <div className="mt-10 flex items-center bg-cogni-card border border-cogni-border rounded-2xl px-5 py-4 gap-3 shadow-xl shadow-black/20">
                <Search size={20} className="text-white/30 flex-shrink-0" />
                <input
                  type="text"
                  value={form.goal}
                  onChange={(e) => update('goal', e.target.value)}
                  placeholder="Search for skills, topics, or paths..."
                  className="flex-1 bg-transparent text-white placeholder-white/30 outline-none"
                />
                <div className="flex items-center gap-1 text-white/20 text-xs border border-white/10 rounded-lg px-2 py-1">
                  <Command size={10} /> K
                </div>
              </div>

              {/* Popular suggestions */}
              <div className="mt-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30 mb-3">
                  Popular Suggestions
                </p>
                <div className="flex flex-wrap gap-2">
                  {POPULAR_SUGGESTIONS.map(({ label, icon, color }) => (
                    <button
                      key={label}
                      onClick={() => update('goal', label)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all hover:scale-[1.02]"
                      style={{
                        borderColor: form.goal === label ? `${color}60` : 'rgba(255,255,255,0.1)',
                        background: form.goal === label ? `${color}15` : 'rgba(255,255,255,0.03)',
                      }}
                    >
                      <span>{icon}</span>
                      <span className="text-sm font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Featured paths */}
              <div className="grid grid-cols-2 gap-4 mt-8">
                {FEATURED_PATHS.map(({ title, subtitle, gradient }) => (
                  <button
                    key={title}
                    onClick={() => update('goal', title)}
                    className={`relative overflow-hidden rounded-2xl p-5 text-left transition-all hover:scale-[1.02] border ${
                      form.goal === title ? 'border-cogni-accent/50' : 'border-white/10'
                    }`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
                    <div className="absolute inset-0 bg-cogni-card/60" />
                    <div className="relative z-10">
                      <h3 className="font-display font-bold text-lg">{title}</h3>
                      <p className="text-xs text-white/50 mt-1">{subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => form.goal && setStep(1)}
                disabled={!form.goal}
                className="cogni-btn-primary w-full mt-8 flex items-center justify-center gap-2 py-3.5 disabled:opacity-30"
              >
                Continue <ArrowRight size={16} />
              </button>
            </motion.div>
          )}

          {/* Step 1: Background + Learner Type */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="w-full"
            >
              <h1 className="font-display font-extrabold text-4xl text-center">
                Tell us about{' '}
                <span className="bg-gradient-to-r from-cogni-accent to-cogni-teal bg-clip-text text-transparent">
                  you
                </span>
              </h1>
              <p className="text-center text-white/40 mt-3">
                This helps Gemini AI calibrate your starting knowledge graph.
              </p>

              <div className="mt-8 space-y-5">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2 flex items-center gap-2">
                    <Target size={12} className="text-cogni-teal" /> Your Background
                  </label>
                  <textarea
                    value={form.background}
                    onChange={(e) => update('background', e.target.value)}
                    placeholder="What do you already know? (e.g., 'I know Python and basic statistics')"
                    rows={3}
                    className="w-full cogni-input resize-none mt-2"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2 flex items-center gap-2">
                    <BookOpen size={12} className="text-cogni-warning" /> Prior Experience (optional)
                  </label>
                  <textarea
                    value={form.prior_history}
                    onChange={(e) => update('prior_history', e.target.value)}
                    placeholder="Any courses, books, or projects you've done?"
                    rows={2}
                    className="w-full cogni-input resize-none mt-2"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3 block">
                    How do you learn best?
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {LEARNER_TYPES.map(({ value, label, desc, icon }) => (
                      <button
                        key={value}
                        onClick={() => update('learner_type', value)}
                        className={`p-4 rounded-xl border text-center transition-all ${
                          form.learner_type === value
                            ? 'border-cogni-accent bg-cogni-accent/10'
                            : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                        }`}
                      >
                        <span className="text-2xl">{icon}</span>
                        <p className="text-sm font-semibold mt-2">{label}</p>
                        <p className="text-[10px] text-white/40 mt-0.5">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setStep(0)}
                  className="cogni-btn-secondary flex-1 py-3.5"
                >
                  Back
                </button>
                <button
                  onClick={() => form.background ? setStep(2) : null}
                  disabled={!form.background}
                  className="cogni-btn-primary flex-1 py-3.5 flex items-center justify-center gap-2 disabled:opacity-30"
                >
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Launch */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="w-full text-center"
            >
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-cogni-accent to-cogni-teal flex items-center justify-center mb-6">
                <Sparkles size={36} className="text-white" />
              </div>
              <h1 className="font-display font-extrabold text-4xl">
                Ready to{' '}
                <span className="bg-gradient-to-r from-cogni-accent to-cogni-teal bg-clip-text text-transparent">
                  launch
                </span>
              </h1>
              <p className="text-white/40 mt-3 max-w-md mx-auto">
                Gemini AI will analyze your profile and create a personalized knowledge graph with 15-25 concepts.
              </p>

              {/* Summary */}
              <div className="mt-8 p-5 rounded-2xl bg-cogni-card border border-cogni-border text-left space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Goal</span>
                  <span className="text-sm font-semibold">{form.goal}</span>
                </div>
                <div className="h-px bg-white/5" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Background</span>
                  <span className="text-sm font-semibold truncate max-w-[250px]">{form.background}</span>
                </div>
                <div className="h-px bg-white/5" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Learner Type</span>
                  <span className="text-sm font-semibold capitalize">{form.learner_type}</span>
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setStep(1)}
                  className="cogni-btn-secondary flex-1 py-3.5"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="cogni-btn-primary flex-1 py-3.5 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {loading ? (
                    <>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }} className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                      Generating your knowledge map...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Launch My CogniPath
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <p className="text-[11px] text-white/20 mt-auto pt-12">
          &copy; 2026 CogniPath AI. Powered by your curiosity.
        </p>
      </div>
    </div>
  )
}
