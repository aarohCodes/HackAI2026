import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine, CartesianGrid, Legend,
} from 'recharts'
import { api } from '../api/client'
import { Sidebar } from '../components/ui/Sidebar'
import { useStore } from '../store/useStore'
import { BarChart3, TrendingUp, Target, Brain } from 'lucide-react'
import { useGamification } from '../hooks/useGamification'

export function MetricsPage() {
  const { sidebarOpen } = useStore()
  const [data, setData] = useState(null)

  useGamification()

  useEffect(() => {
    api.get('/decay/metrics').then((res) => setData(res.data)).catch(() => {})
  }, [])

  const metrics = data?.metrics
  const curves = data?.curves

  const featureData = metrics?.feature_importance
    ? Object.entries(metrics.feature_importance)
        .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value: parseFloat(value) }))
        .sort((a, b) => b.value - a.value)
    : []

  const curveData = curves
    ? curves.days.map((d, i) => ({
        day: d,
        Generic: curves.generic[i],
        Consistent: curves.consistent[i],
        Binge: curves.binge[i],
      }))
    : []

  const kpis = metrics
    ? [
        { label: 'RMSE', value: metrics.rmse, icon: Target, color: '#8B5CF6' },
        { label: 'MAE', value: metrics.mae, icon: BarChart3, color: '#06B6D4' },
        { label: 'Precision', value: metrics.precision_at_threshold, icon: Target, color: '#10B981' },
        { label: 'Recall', value: metrics.recall_at_threshold, icon: Target, color: '#F59E0B' },
        { label: 'Lift', value: `${metrics.personalization_lift_pct}%`, icon: TrendingUp, color: '#2DD4BF' },
      ]
    : []

  return (
    <div className="min-h-screen bg-cogni-bg">
      <Sidebar />
      <div
        className="transition-all duration-300 p-8"
        style={{ marginLeft: sidebarOpen ? 224 : 72 }}
      >
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-black">
                <span className="cogni-gradient-text">Cognitive Analysis</span>
              </h1>
              <p className="text-white/40 mt-1">Real-time deep learning architecture insights</p>
            </div>
            <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
              {['24H', '7D', '30D'].map((period, i) => (
                <button
                  key={period}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    i === 1
                      ? 'bg-cogni-accent text-white'
                      : 'text-white/40 hover:text-white'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          {/* KPI Cards */}
          {kpis.length > 0 && (
            <div className="grid grid-cols-5 gap-4 mb-8">
              {kpis.map(({ label, value, icon: Icon, color }, i) => (
                <motion.div
                  key={label}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: i * 0.08 }}
                  className="cogni-card"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Icon size={14} style={{ color }} />
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
                      {label}
                    </p>
                  </div>
                  <p className="text-3xl font-black text-white">
                    {typeof value === 'number' ? value.toFixed(4) : value}
                  </p>
                </motion.div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Feature Importance */}
            {featureData.length > 0 && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="cogni-card"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Brain size={16} className="text-cogni-accent" />
                  <h3 className="font-bold">Feature Importance</h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={featureData} layout="vertical" margin={{ left: 100 }}>
                    <XAxis type="number" stroke="#4B5563" tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" stroke="#4B5563" tick={{ fill: '#9CA3AF', fontSize: 11 }} width={100} />
                    <Tooltip
                      contentStyle={{ background: '#0D1B2A', border: '1px solid #1E3A5F', borderRadius: 12 }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="value" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            )}

            {/* Decay Curves */}
            {curveData.length > 0 && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="cogni-card"
              >
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={16} className="text-cogni-teal" />
                  <h3 className="font-bold">Decay Curves</h3>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={curveData}>
                    <CartesianGrid stroke="#1E3A5F" strokeDasharray="3 3" />
                    <XAxis dataKey="day" stroke="#4B5563" tick={{ fill: '#9CA3AF', fontSize: 11 }} label={{ value: 'Days Since Review', position: 'insideBottom', offset: -5, fill: '#6B7280' }} />
                    <YAxis stroke="#4B5563" tick={{ fill: '#9CA3AF', fontSize: 11 }} domain={[0, 1]} />
                    <Tooltip contentStyle={{ background: '#0D1B2A', border: '1px solid #1E3A5F', borderRadius: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine y={0.7} stroke="#EF4444" strokeDasharray="8 4" label={{ value: 'Threshold 0.70', fill: '#EF4444', fontSize: 11 }} />
                    <Line type="monotone" dataKey="Generic" stroke="#6B7280" strokeDasharray="6 3" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Consistent" stroke="#10B981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Binge" stroke="#EF4444" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>
            )}
          </div>

          {/* Model Architecture Summary */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="cogni-card"
          >
            <h3 className="font-bold mb-4">Model Architecture</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Algorithm', value: 'XGBoost Regression' },
                { label: 'Features', value: '10 behavioral signals' },
                { label: 'Training Size', value: '~25,000 records' },
                { label: 'Test Split', value: '20% holdout' },
                { label: 'Threshold', value: 'R(t) < 0.70' },
                { label: 'Foundation', value: 'Ebbinghaus Forgetting Curve' },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 rounded-xl bg-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{label}</p>
                  <p className="text-sm font-semibold mt-1">{value}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
