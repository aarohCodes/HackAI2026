import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from '../components/ui/Sidebar'
import { useStore } from '../store/useStore'
import { api } from '../api/client'
import {
  Zap, ArrowLeft, CheckCircle, XCircle,
  Timer, Sparkles, Trophy, RotateCcw
} from 'lucide-react'

export function DrillPage() {
  const navigate = useNavigate()
  const { user, sidebarOpen } = useStore()
  const [loading, setLoading] = useState(true)
  const [drill, setDrill] = useState(null)
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [finished, setFinished] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    api.post('/assess/drill/generate', {})
      .then((res) => {
        setDrill(res.data)
        setTimeLeft(res.data.time_limit_seconds || 225)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Drill generation failed:', err)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!drill || finished || loading) return
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          setFinished(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [drill, finished, loading])

  const handleAnswer = (answer) => {
    if (!drill) return
    const q = drill.questions[currentQ]
    const isCorrect = String(answer).toLowerCase() === String(q.correct_answer).toLowerCase()
    setAnswers((prev) => ({ ...prev, [currentQ]: { answer, correct: isCorrect } }))

    setTimeout(() => {
      if (currentQ < drill.questions.length - 1) {
        setCurrentQ((prev) => prev + 1)
      } else {
        clearInterval(timerRef.current)
        setFinished(true)
      }
    }, 600)
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const totalTimeSec = drill?.time_limit_seconds || 225
  const timePct = (timeLeft / totalTimeSec) * 100
  const timeColor = timePct > 50 ? '#10B981' : timePct > 20 ? '#F59E0B' : '#EF4444'

  if (loading) {
    return (
      <div className="min-h-screen bg-cogni-bg">
        <Sidebar />
        <div className="transition-all duration-300 p-8 flex items-center justify-center min-h-screen" style={{ marginLeft: sidebarOpen ? 224 : 72 }}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
              <Zap size={48} className="mx-auto text-cogni-warning" />
            </motion.div>
            <p className="mt-4 text-white/50 font-semibold">Generating rapid-fire drills...</p>
            <p className="text-xs text-white/25 mt-1">Targeting your weakest concepts</p>
          </motion.div>
        </div>
      </div>
    )
  }

  if (!drill || !drill.questions?.length) {
    return (
      <div className="min-h-screen bg-cogni-bg">
        <Sidebar />
        <div className="transition-all duration-300 p-8 flex items-center justify-center min-h-screen" style={{ marginLeft: sidebarOpen ? 224 : 72 }}>
          <div className="text-center">
            <p className="text-white/50">Could not generate drills. Please try again.</p>
            <button onClick={() => navigate('/assess')} className="cogni-btn-primary mt-4">Back</button>
          </div>
        </div>
      </div>
    )
  }

  if (finished) {
    const answeredCount = Object.keys(answers).length
    const correctCount = Object.values(answers).filter((a) => a.correct).length
    const elapsed = totalTimeSec - timeLeft
    const avgTime = answeredCount > 0 ? (elapsed / answeredCount).toFixed(1) : 0

    return (
      <div className="min-h-screen bg-cogni-bg">
        <Sidebar />
        <div className="transition-all duration-300 p-8" style={{ marginLeft: sidebarOpen ? 224 : 72 }}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-2xl mx-auto text-center">
            <Zap size={48} className="mx-auto text-cogni-warning mb-4" />
            <h1 className="text-2xl font-black mb-2">Drill Complete!</h1>
            <p className="text-white/40 mb-6">{drill.drill_title}</p>

            <div className="flex justify-center gap-4 mb-8">
              <div className="cogni-card text-center px-5">
                <p className="text-2xl font-black text-cogni-teal">{correctCount}/{answeredCount}</p>
                <p className="text-[10px] text-white/30 uppercase">Correct</p>
              </div>
              <div className="cogni-card text-center px-5">
                <p className="text-2xl font-black">{avgTime}s</p>
                <p className="text-[10px] text-white/30 uppercase">Avg / Question</p>
              </div>
              <div className="cogni-card text-center px-5">
                <p className="text-2xl font-black text-cogni-accent">+{correctCount * 10} XP</p>
                <p className="text-[10px] text-white/30 uppercase">Earned</p>
              </div>
            </div>

            {/* Review answers */}
            <div className="text-left mb-6 space-y-2">
              {drill.questions.slice(0, answeredCount).map((q, i) => {
                const a = answers[i]
                return (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${a?.correct ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                    {a?.correct ? <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" /> : <XCircle size={16} className="text-red-400 flex-shrink-0" />}
                    <span className="text-sm text-white/60 truncate flex-1">{q.question}</span>
                    <span className="text-xs text-white/30">{q.concept}</span>
                  </div>
                )
              })}
            </div>

            <div className="flex justify-center gap-3">
              <button onClick={() => navigate('/assess')} className="cogni-btn-secondary flex items-center gap-2">
                <ArrowLeft size={16} /> Back
              </button>
              <button onClick={() => window.location.reload()} className="cogni-btn-primary flex items-center gap-2">
                <RotateCcw size={16} /> New Drill
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  const q = drill.questions[currentQ]
  const isAnswered = answers[currentQ] !== undefined
  const isTrueFalse = q.type === 'true_false'

  return (
    <div className="min-h-screen bg-cogni-bg">
      <Sidebar />
      <div className="transition-all duration-300 p-8" style={{ marginLeft: sidebarOpen ? 224 : 72 }}>
        <div className="max-w-2xl mx-auto">
          {/* Timer + Progress header */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigate('/assess')} className="text-white/30 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Timer size={16} style={{ color: timeColor }} />
                <span className="font-mono font-bold text-sm" style={{ color: timeColor }}>{formatTime(timeLeft)}</span>
              </div>
              <span className="text-xs text-white/30">{currentQ + 1}/{drill.questions.length}</span>
            </div>
          </div>

          {/* Time progress bar */}
          <div className="h-1 bg-white/5 rounded-full mb-6 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: timeColor }}
              animate={{ width: `${timePct}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentQ}
              initial={{ x: 30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -30, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="cogni-card"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-white/30">{q.concept}</span>
                <span className="text-xs text-white/20">{q.type.replace('_', ' ')}</span>
              </div>

              <p className="text-lg font-semibold mb-6">{q.question}</p>

              {isTrueFalse ? (
                <div className="flex gap-3">
                  {['true', 'false'].map((val) => {
                    const isSelected = answers[currentQ]?.answer === val
                    const correct = isSelected && answers[currentQ]?.correct
                    let cls = 'border-white/10 hover:border-white/30'
                    if (isSelected) cls = correct ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-red-500/60 bg-red-500/10'

                    return (
                      <button
                        key={val}
                        disabled={isAnswered}
                        onClick={() => handleAnswer(val)}
                        className={`flex-1 p-4 rounded-xl border text-center font-semibold transition-all ${cls}`}
                      >
                        {val === 'true' ? 'True' : 'False'}
                        {isSelected && (correct ? <CheckCircle size={14} className="inline ml-2 text-emerald-400" /> : <XCircle size={14} className="inline ml-2 text-red-400" />)}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {(q.options || []).map((opt, i) => {
                    const letter = opt.charAt(0)
                    const isSelected = answers[currentQ]?.answer === letter
                    const correct = isSelected && answers[currentQ]?.correct
                    let cls = 'border-white/10 hover:border-white/30'
                    if (isSelected) cls = correct ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-red-500/60 bg-red-500/10'

                    return (
                      <button
                        key={i}
                        disabled={isAnswered}
                        onClick={() => handleAnswer(letter)}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center gap-3 ${cls}`}
                      >
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          isSelected ? (correct ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white') : 'bg-white/5 text-white/40'
                        }`}>{letter}</span>
                        <span className="text-sm">{opt.slice(3)}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
