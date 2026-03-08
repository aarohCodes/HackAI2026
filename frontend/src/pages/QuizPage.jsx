import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from '../components/ui/Sidebar'
import { useStore } from '../store/useStore'
import { api } from '../api/client'
import {
  Brain, ChevronRight, CheckCircle, XCircle, Clock,
  Zap, Trophy, ArrowLeft, Loader2, RotateCcw, Sparkles
} from 'lucide-react'

function QuestionCard({ question, index, total, onAnswer, answered, selectedAnswer }) {
  const isMultipleChoice = question.type === 'multiple_choice' || question.type === 'code_trace'
  const isTrueFalse = question.type === 'true_false'
  const isFillBlank = question.type === 'fill_blank'
  const isOrdering = question.type === 'ordering'

  const [fillAnswer, setFillAnswer] = useState('')
  const [orderItems, setOrderItems] = useState(question.items ? [...question.items] : [])

  const correct = answered && selectedAnswer === question.correct_answer
  const showResult = answered

  const moveItem = (fromIdx, toIdx) => {
    if (answered) return
    const updated = [...orderItems]
    const [item] = updated.splice(fromIdx, 1)
    updated.splice(toIdx, 0, item)
    setOrderItems(updated)
  }

  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -40, opacity: 0 }}
      className="cogni-card max-w-3xl mx-auto"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-cogni-accent bg-cogni-accent/10 px-2.5 py-1 rounded-lg">
            {index + 1} / {total}
          </span>
          <span className="text-xs text-white/30 uppercase tracking-wider">{question.type.replace('_', ' ')}</span>
        </div>
        <span className="text-xs text-white/30">
          {question.concept} &middot; {question.difficulty}
        </span>
      </div>

      {question.code_snippet && (
        <pre className="bg-black/40 border border-white/10 rounded-xl p-4 mb-4 text-sm font-mono text-cogni-teal overflow-x-auto">
          {question.code_snippet}
        </pre>
      )}

      <p className="text-lg font-semibold mb-6 leading-relaxed">{question.question}</p>

      {/* Multiple choice / Code trace */}
      {isMultipleChoice && (
        <div className="space-y-2.5">
          {question.options.map((opt, i) => {
            const letter = opt.charAt(0)
            const isSelected = selectedAnswer === letter
            const isCorrectOpt = letter === question.correct_answer
            let borderClass = 'border-white/10 hover:border-white/30'
            if (showResult && isCorrectOpt) borderClass = 'border-emerald-500/60 bg-emerald-500/10'
            else if (showResult && isSelected && !correct) borderClass = 'border-red-500/60 bg-red-500/10'
            else if (isSelected && !showResult) borderClass = 'border-cogni-accent bg-cogni-accent/10'

            return (
              <button
                key={i}
                disabled={answered}
                onClick={() => onAnswer(letter)}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3 ${borderClass} ${answered ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  isSelected ? 'bg-cogni-accent text-white' : 'bg-white/5 text-white/40'
                }`}>
                  {letter}
                </span>
                <span className="text-sm">{opt.slice(3)}</span>
                {showResult && isCorrectOpt && <CheckCircle size={18} className="ml-auto text-emerald-400" />}
                {showResult && isSelected && !correct && <XCircle size={18} className="ml-auto text-red-400" />}
              </button>
            )
          })}
        </div>
      )}

      {/* True / False */}
      {isTrueFalse && (
        <div className="flex gap-3">
          {['true', 'false'].map((val) => {
            const isSelected = selectedAnswer === val
            const isCorrectOpt = val === question.correct_answer
            let cls = 'border-white/10 hover:border-white/30'
            if (showResult && isCorrectOpt) cls = 'border-emerald-500/60 bg-emerald-500/10'
            else if (showResult && isSelected && !correct) cls = 'border-red-500/60 bg-red-500/10'
            else if (isSelected && !showResult) cls = 'border-cogni-accent bg-cogni-accent/10'

            return (
              <button
                key={val}
                disabled={answered}
                onClick={() => onAnswer(val)}
                className={`flex-1 p-4 rounded-xl border text-center font-semibold transition-all ${cls} ${answered ? 'cursor-default' : 'cursor-pointer'}`}
              >
                {val === 'true' ? 'True' : 'False'}
              </button>
            )
          })}
        </div>
      )}

      {/* Fill in blank */}
      {isFillBlank && (
        <div className="space-y-3">
          <input
            value={fillAnswer}
            onChange={(e) => setFillAnswer(e.target.value)}
            disabled={answered}
            placeholder="Type your answer..."
            className="w-full cogni-input text-lg"
            onKeyDown={(e) => e.key === 'Enter' && !answered && fillAnswer.trim() && onAnswer(fillAnswer.trim())}
          />
          {!answered && (
            <button
              onClick={() => fillAnswer.trim() && onAnswer(fillAnswer.trim())}
              disabled={!fillAnswer.trim()}
              className="cogni-btn-primary disabled:opacity-40"
            >
              Submit Answer
            </button>
          )}
        </div>
      )}

      {/* Ordering */}
      {isOrdering && (
        <div className="space-y-2">
          {orderItems.map((item, i) => (
            <div key={item} className="flex items-center gap-2">
              <span className="w-6 text-xs text-white/30 text-center">{i + 1}.</span>
              <div className="flex-1 p-3 rounded-xl border border-white/10 bg-white/5 text-sm">
                {item}
              </div>
              <div className="flex flex-col gap-0.5">
                {i > 0 && (
                  <button onClick={() => moveItem(i, i - 1)} className="text-white/30 hover:text-white text-xs">&uarr;</button>
                )}
                {i < orderItems.length - 1 && (
                  <button onClick={() => moveItem(i, i + 1)} className="text-white/30 hover:text-white text-xs">&darr;</button>
                )}
              </div>
            </div>
          ))}
          {!answered && (
            <button
              onClick={() => {
                const userOrder = orderItems.map((item) => question.items.indexOf(item))
                onAnswer(JSON.stringify(userOrder))
              }}
              className="cogni-btn-primary mt-2"
            >
              Lock In Order
            </button>
          )}
        </div>
      )}

      {/* Explanation */}
      {showResult && (
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className={`mt-5 p-4 rounded-xl border ${correct ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}
        >
          <p className={`text-sm font-semibold mb-1 ${correct ? 'text-emerald-400' : 'text-red-400'}`}>
            {correct ? 'Correct!' : 'Not quite.'}
          </p>
          <p className="text-sm text-white/60">{question.explanation}</p>
        </motion.div>
      )}
    </motion.div>
  )
}

export function QuizPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const topicParam = searchParams.get('topic')
  const { user, sidebarOpen } = useStore()
  const [loading, setLoading] = useState(true)
  const [quiz, setQuiz] = useState(null)
  const [quizError, setQuizError] = useState(null)
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState({})
  const [startTime] = useState(Date.now())
  const [finished, setFinished] = useState(false)
  const [results, setResults] = useState(null)

  useEffect(() => {
    setQuizError(null)
    const generateQuiz = async () => {
      try {
        if (topicParam) {
          const res = await api.post('/quiz', { topic: topicParam })
          const data = res.data
          if (!data.questions?.length) {
            setQuizError('No questions generated. Try a different topic.')
            return
          }
          setQuiz({
            quiz_title: `Quiz: ${data.topic}`,
            total_questions: data.questions.length,
            estimated_minutes: Math.ceil(data.questions.length * 1.5),
            questions: data.questions.map((q) => ({
              type: 'multiple_choice',
              question: q.question,
              concept: data.topic,
              difficulty: 'mixed',
              options: (q.options || []).map((o) => `${o.label || '?'}. ${o.text || ''}`),
              correct_answer: q.correct_answer,
              explanation: q.explanation || '',
            })),
          })
        } else {
          const res = await api.post('/assess/quiz/generate', { difficulty: 'mixed' })
          setQuiz(res.data)
        }
      } catch (err) {
        const msg = err.response?.data?.detail || err.message || 'Quiz generation failed.'
        setQuizError(Array.isArray(msg) ? msg.join(' ') : msg)
        console.error('Failed to generate quiz:', err)
      } finally {
        setLoading(false)
      }
    }
    generateQuiz()
  }, [topicParam])

  const handleAnswer = useCallback(async (answer) => {
    if (!quiz) return
    const q = quiz.questions[currentQ]
    const isCorrect = String(answer).toLowerCase() === String(q.correct_answer).toLowerCase()

    if (q.type === 'fill_blank' && !isCorrect) {
      const alts = q.accept_alternatives || []
      const altCorrect = alts.some(
        (a) => a.toLowerCase() === String(answer).toLowerCase()
      )
      if (altCorrect) {
        setAnswers((prev) => ({ ...prev, [currentQ]: { answer, correct: true } }))
        return
      }
    }

    setAnswers((prev) => ({ ...prev, [currentQ]: { answer, correct: isCorrect } }))
  }, [quiz, currentQ])

  const nextQuestion = () => {
    if (currentQ < quiz.questions.length - 1) {
      setCurrentQ(currentQ + 1)
    } else {
      finishQuiz()
    }
  }

  const finishQuiz = async () => {
    const correctCount = Object.values(answers).filter((a) => a.correct).length
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    const concepts = [...new Set(quiz.questions.map((q) => q.concept))]

    try {
      const res = await api.post('/assess/quiz/complete', {
        total_questions: quiz.questions.length,
        correct_answers: correctCount,
        time_seconds: elapsed,
        concepts_tested: concepts,
      })
      setResults(res.data)
    } catch {
      setResults({
        score_pct: Math.round((correctCount / quiz.questions.length) * 100),
        correct: correctCount,
        total: quiz.questions.length,
        xp_earned: correctCount * 15,
      })
    }
    setFinished(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cogni-bg">
        <Sidebar />
        <div className="transition-all duration-300 p-8 flex items-center justify-center min-h-screen" style={{ marginLeft: sidebarOpen ? 224 : 72 }}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
              <Brain size={48} className="mx-auto text-cogni-accent" />
            </motion.div>
            <p className="mt-4 text-white/50 font-semibold">Gemini is crafting your personalized quiz...</p>
            <p className="text-xs text-white/25 mt-1">Analyzing your knowledge graph to build adaptive questions</p>
          </motion.div>
        </div>
      </div>
    )
  }

  if (!quiz || !quiz.questions?.length) {
    return (
      <div className="min-h-screen bg-cogni-bg">
        <Sidebar />
        <div className="transition-all duration-300 p-8 flex items-center justify-center min-h-screen" style={{ marginLeft: sidebarOpen ? 224 : 72 }}>
          <div className="text-center max-w-md">
            <p className="text-white/50">
              {quizError || 'Could not generate quiz. Please try again.'}
            </p>
            <div className="flex justify-center gap-3 mt-6">
              <button onClick={() => navigate('/assess')} className="cogni-btn-secondary">Back to Assessment</button>
              <button onClick={() => window.location.reload()} className="cogni-btn-primary">Try Again</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (finished && results) {
    const scorePct = results.score_pct || 0
    const grade = scorePct >= 90 ? 'A' : scorePct >= 80 ? 'B' : scorePct >= 70 ? 'C' : scorePct >= 60 ? 'D' : 'F'
    const gradeColor = scorePct >= 80 ? '#10B981' : scorePct >= 60 ? '#F59E0B' : '#EF4444'

    return (
      <div className="min-h-screen bg-cogni-bg">
        <Sidebar />
        <div className="transition-all duration-300 p-8" style={{ marginLeft: sidebarOpen ? 224 : 72 }}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-2xl mx-auto text-center">
            <div className="relative w-32 h-32 mx-auto mb-6">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                <motion.circle
                  cx="60" cy="60" r="52" fill="none"
                  stroke={gradeColor} strokeWidth="8" strokeLinecap="round"
                  initial={{ strokeDasharray: '0 326.7' }}
                  animate={{ strokeDasharray: `${(scorePct / 100) * 326.7} 326.7` }}
                  transition={{ duration: 1.5, ease: 'easeOut' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black" style={{ color: gradeColor }}>{grade}</span>
                <span className="text-xs text-white/40">{scorePct}%</span>
              </div>
            </div>

            <h1 className="text-2xl font-black mb-2">{quiz.quiz_title}</h1>
            <p className="text-white/40 mb-6">
              {results.correct} of {results.total} correct
            </p>

            <div className="flex justify-center gap-4 mb-8">
              <div className="cogni-card text-center px-6">
                <Zap size={20} className="mx-auto text-cogni-warning mb-1" />
                <p className="text-xl font-black text-cogni-teal">+{results.xp_earned}</p>
                <p className="text-[10px] text-white/30 uppercase tracking-wider">XP Earned</p>
              </div>
              <div className="cogni-card text-center px-6">
                <Trophy size={20} className="mx-auto text-cogni-accent mb-1" />
                <p className="text-xl font-black">{results.mastery_updated || 0}</p>
                <p className="text-[10px] text-white/30 uppercase tracking-wider">Nodes Leveled</p>
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <button onClick={() => navigate('/assess')} className="cogni-btn-secondary flex items-center gap-2">
                <ArrowLeft size={16} /> Back
              </button>
              <button onClick={() => window.location.reload()} className="cogni-btn-primary flex items-center gap-2">
                <RotateCcw size={16} /> New Quiz
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  const currentQuestion = quiz.questions[currentQ]
  const isAnswered = answers[currentQ] !== undefined
  const progressPct = ((currentQ + (isAnswered ? 1 : 0)) / quiz.questions.length) * 100

  return (
    <div className="min-h-screen bg-cogni-bg">
      <Sidebar />
      <div className="transition-all duration-300 p-8" style={{ marginLeft: sidebarOpen ? 224 : 72 }}>
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/assess')} className="text-white/30 hover:text-white transition-colors">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="font-bold">{quiz.quiz_title}</h1>
                <p className="text-xs text-white/30">{quiz.total_questions} questions &middot; ~{quiz.estimated_minutes} min</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/30">
              <Sparkles size={14} className="text-cogni-accent" />
              Generated by Gemini
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-white/5 rounded-full mb-8 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-cogni-accent to-cogni-teal"
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <AnimatePresence mode="wait">
            <QuestionCard
              key={currentQ}
              question={currentQuestion}
              index={currentQ}
              total={quiz.questions.length}
              onAnswer={handleAnswer}
              answered={isAnswered}
              selectedAnswer={answers[currentQ]?.answer}
            />
          </AnimatePresence>

          {isAnswered && (
            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex justify-center mt-6">
              <button onClick={nextQuestion} className="cogni-btn-primary flex items-center gap-2">
                {currentQ < quiz.questions.length - 1 ? (
                  <>Next Question <ChevronRight size={16} /></>
                ) : (
                  <>Finish Quiz <Trophy size={16} /></>
                )}
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
