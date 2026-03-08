import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from '../components/ui/Sidebar'
import { useStore } from '../store/useStore'
import { api } from '../api/client'
import {
  Theater, ArrowLeft, ChevronRight, CheckCircle,
  XCircle, Sparkles, Shield, AlertTriangle, Trophy
} from 'lucide-react'

export function ScenarioPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, sidebarOpen, graphNodes, fetchGraph } = useStore()
  const conceptParam = searchParams.get('concept') || searchParams.get('topic')

  const [loading, setLoading] = useState(true)
  const [scenario, setScenario] = useState(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    const loadAndGenerate = async () => {
      let concept = conceptParam
      if (!concept) {
        const { nodes } = await fetchGraph()
        const weak = nodes.filter((n) => ['fading', 'yellow', 'red'].includes(n.state))
        concept = weak.length > 0 ? weak[Math.floor(Math.random() * weak.length)].concept : (nodes[0]?.concept || 'General Knowledge')
      }

      try {
        const res = await api.post('/assess/scenario/generate', { concept })
        setScenario(res.data)
      } catch (err) {
        console.error('Scenario generation failed:', err)
      }
      setLoading(false)
    }
    loadAndGenerate()
  }, [conceptParam])

  const handleStepAnswer = (answer) => {
    const step = scenario.steps[currentStep]
    const isCorrect = answer === step.correct_answer
    setAnswers((prev) => ({ ...prev, [currentStep]: { answer, correct: isCorrect } }))
  }

  const nextStep = () => {
    if (currentStep < scenario.steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      setFinished(true)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cogni-bg">
        <Sidebar />
        <div className="transition-all duration-300 p-8 flex items-center justify-center min-h-screen" style={{ marginLeft: sidebarOpen ? 224 : 72 }}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
              <Theater size={48} className="mx-auto text-cogni-accent" />
            </motion.div>
            <p className="mt-4 text-white/50 font-semibold">Building your scenario simulation...</p>
            <p className="text-xs text-white/25 mt-1">Gemini is crafting a real-world case study</p>
          </motion.div>
        </div>
      </div>
    )
  }

  if (!scenario || !scenario.steps?.length) {
    return (
      <div className="min-h-screen bg-cogni-bg">
        <Sidebar />
        <div className="transition-all duration-300 p-8 flex items-center justify-center min-h-screen" style={{ marginLeft: sidebarOpen ? 224 : 72 }}>
          <div className="text-center">
            <p className="text-white/50">Could not generate scenario. Please try again.</p>
            <button onClick={() => navigate('/assess')} className="cogni-btn-primary mt-4">Back</button>
          </div>
        </div>
      </div>
    )
  }

  if (finished) {
    const correctCount = Object.values(answers).filter((a) => a.correct).length
    const totalSteps = scenario.steps.length

    return (
      <div className="min-h-screen bg-cogni-bg">
        <Sidebar />
        <div className="transition-all duration-300 p-8" style={{ marginLeft: sidebarOpen ? 224 : 72 }}>
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <Trophy size={48} className="mx-auto text-cogni-warning mb-3" />
              <h1 className="text-2xl font-black mb-2">Scenario Complete</h1>
              <p className="text-white/40">{scenario.scenario_title}</p>
            </div>

            <div className="cogni-card mb-6">
              <p className="text-sm font-bold text-cogni-accent mb-2">MISSION DEBRIEF</p>
              <p className="text-white/60 text-sm leading-relaxed">{scenario.debrief}</p>
            </div>

            <div className="flex justify-center gap-4 mb-6">
              <div className="cogni-card text-center px-6">
                <p className="text-2xl font-black text-cogni-teal">{correctCount}/{totalSteps}</p>
                <p className="text-[10px] text-white/30 uppercase tracking-wider">Decisions Correct</p>
              </div>
              <div className="cogni-card text-center px-6">
                <p className="text-2xl font-black">{Math.round((correctCount / totalSteps) * 100)}%</p>
                <p className="text-[10px] text-white/30 uppercase tracking-wider">Success Rate</p>
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <button onClick={() => navigate('/assess')} className="cogni-btn-secondary flex items-center gap-2">
                <ArrowLeft size={16} /> Back
              </button>
              <button onClick={() => window.location.reload()} className="cogni-btn-primary flex items-center gap-2">
                <Sparkles size={16} /> New Scenario
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  const step = scenario.steps[currentStep]
  const isAnswered = answers[currentStep] !== undefined
  const selectedAnswer = answers[currentStep]?.answer
  const isCorrect = answers[currentStep]?.correct

  return (
    <div className="min-h-screen bg-cogni-bg">
      <Sidebar />
      <div className="transition-all duration-300 p-8" style={{ marginLeft: sidebarOpen ? 224 : 72 }}>
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate('/assess')} className="text-white/30 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2 text-xs text-white/30">
              <Sparkles size={14} className="text-cogni-accent" /> Gemini Scenario
            </div>
          </div>

          {/* Scenario intro card */}
          {currentStep === 0 && (
            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="cogni-card mb-6 border-cogni-accent/20">
              <h2 className="text-xl font-black mb-2">{scenario.scenario_title}</h2>
              <p className="text-sm text-white/50 mb-3">{scenario.setting}</p>
              <div className="flex gap-4">
                <div className="flex items-center gap-2 text-xs">
                  <Shield size={14} className="text-cogni-teal" />
                  <span className="text-white/40"><strong className="text-white/70">Role:</strong> {scenario.your_role}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <AlertTriangle size={14} className="text-cogni-warning" />
                  <span className="text-white/40"><strong className="text-white/70">Stakes:</strong> {scenario.stakes}</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Progress */}
          <div className="h-1.5 bg-white/5 rounded-full mb-6 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-cogni-accent to-cogni-teal"
              animate={{ width: `${((currentStep + (isAnswered ? 1 : 0)) / scenario.steps.length) * 100}%` }}
            />
          </div>

          {/* Current step */}
          <AnimatePresence mode="wait">
            <motion.div key={currentStep} initial={{ x: 30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -30, opacity: 0 }} className="cogni-card">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-cogni-accent bg-cogni-accent/10 px-2.5 py-1 rounded-lg">
                  Step {step.step} of {scenario.steps.length}
                </span>
                <span className="text-xs text-white/30">{step.concept_tested}</span>
              </div>

              <p className="text-sm text-white/60 mb-4 leading-relaxed">{step.situation}</p>
              <p className="font-semibold mb-5">{step.question}</p>

              <div className="space-y-2.5">
                {step.options.map((opt, i) => {
                  const letter = opt.charAt(0)
                  const isSelected = selectedAnswer === letter
                  const isCorrectOpt = letter === step.correct_answer
                  let cls = 'border-white/10 hover:border-white/30'
                  if (isAnswered && isCorrectOpt) cls = 'border-emerald-500/60 bg-emerald-500/10'
                  else if (isAnswered && isSelected && !isCorrect) cls = 'border-red-500/60 bg-red-500/10'
                  else if (isSelected && !isAnswered) cls = 'border-cogni-accent bg-cogni-accent/10'

                  return (
                    <button
                      key={i}
                      disabled={isAnswered}
                      onClick={() => handleStepAnswer(letter)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3 ${cls} ${isAnswered ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        isSelected ? 'bg-cogni-accent text-white' : 'bg-white/5 text-white/40'
                      }`}>{letter}</span>
                      <span className="text-sm">{opt.slice(3)}</span>
                      {isAnswered && isCorrectOpt && <CheckCircle size={16} className="ml-auto text-emerald-400" />}
                      {isAnswered && isSelected && !isCorrect && <XCircle size={16} className="ml-auto text-red-400" />}
                    </button>
                  )
                })}
              </div>

              {isAnswered && (
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className={`mt-5 p-4 rounded-xl border ${isCorrect ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}
                >
                  <p className={`text-sm font-semibold ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isCorrect ? step.consequence_correct : step.consequence_wrong}
                  </p>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>

          {isAnswered && (
            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex justify-center mt-6">
              <button onClick={nextStep} className="cogni-btn-primary flex items-center gap-2">
                {currentStep < scenario.steps.length - 1 ? (
                  <>Continue <ChevronRight size={16} /></>
                ) : (
                  <>Complete Mission <Trophy size={16} /></>
                )}
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
