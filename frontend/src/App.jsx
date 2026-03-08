import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useStore } from './store/useStore'
import { CanvasPage } from './pages/Canvas'
import { ConceptPage } from './pages/ConceptPage'
import { QuizPage } from './pages/QuizPage'
import { motion } from 'framer-motion'
import { Brain } from 'lucide-react'

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-cogni-bg flex items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
          <Brain size={48} className="mx-auto text-cogni-accent" />
        </motion.div>
        <p className="mt-4 text-white/50 font-semibold">Loading CogniPath...</p>
      </motion.div>
    </div>
  )
}

export default function App() {
  const authReady = useStore((s) => s.authReady)
  const initAuth = useStore((s) => s.initAuth)

  useEffect(() => {
    initAuth()
  }, [initAuth])

  if (!authReady) return <LoadingScreen />

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<CanvasPage />} />
        <Route path="/canvas" element={<CanvasPage />} />
        <Route path="/learn/:nodeId" element={<ConceptPage />} />
        <Route path="/assess/quiz" element={<QuizPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
