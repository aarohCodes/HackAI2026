import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store/useStore'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { Onboarding } from './pages/Onboarding'
import { DashboardPage } from './pages/Dashboard'
import { HubsPage } from './pages/Hubs'
import { CanvasPage } from './pages/Canvas'
import { VideoViewPage } from './pages/VideoView'
import { MetricsPage } from './pages/Metrics'
import { AssessmentPage } from './pages/Assessment'
import { QuizPage } from './pages/QuizPage'
import { ScenarioPage } from './pages/ScenarioPage'
import { DrillPage } from './pages/DrillPage'

function ProtectedRoute({ children }) {
  const user = useStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  return children
}

function OnboardGuard({ children }) {
  const user = useStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.has_onboarded) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  const user = useStore((s) => s.user)

  const homePath = !user
    ? '/'
    : user.has_onboarded
      ? '/dashboard'
      : '/onboarding'

  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={user ? <Navigate to={homePath} replace /> : <Landing />} />
        <Route path="/login" element={user ? <Navigate to={homePath} replace /> : <Login />} />

        {/* Onboarding */}
        <Route path="/onboarding" element={<OnboardGuard><Onboarding /></OnboardGuard>} />

        {/* Protected app pages */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/hubs" element={<ProtectedRoute><HubsPage /></ProtectedRoute>} />
        <Route path="/canvas" element={<ProtectedRoute><CanvasPage /></ProtectedRoute>} />
        <Route path="/video/:nodeId" element={<ProtectedRoute><VideoViewPage /></ProtectedRoute>} />
        <Route path="/metrics" element={<ProtectedRoute><MetricsPage /></ProtectedRoute>} />
        <Route path="/assess" element={<ProtectedRoute><AssessmentPage /></ProtectedRoute>} />
        <Route path="/assess/quiz" element={<ProtectedRoute><QuizPage /></ProtectedRoute>} />
        <Route path="/assess/scenario" element={<ProtectedRoute><ScenarioPage /></ProtectedRoute>} />
        <Route path="/assess/drill" element={<ProtectedRoute><DrillPage /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to={homePath} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
