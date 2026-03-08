import { motion } from 'framer-motion'

export function MetricsPanel({ metrics }) {
  if (!metrics) return null

  const kpis = [
    { label: 'RMSE', value: metrics.rmse, color: '#8B5CF6' },
    { label: 'MAE', value: metrics.mae, color: '#06B6D4' },
    { label: 'Precision @ 0.70', value: metrics.precision_at_threshold, color: '#10B981' },
    { label: 'Recall @ 0.70', value: metrics.recall_at_threshold, color: '#F59E0B' },
    { label: 'Personalization Lift', value: `${metrics.personalization_lift_pct}%`, color: '#2DD4BF' },
  ]

  return (
    <div className="grid grid-cols-5 gap-3">
      {kpis.map(({ label, value, color }, i) => (
        <motion.div
          key={label}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: i * 0.1 }}
          className="cogni-card text-center"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
            {label}
          </p>
          <p className="text-2xl font-black mt-2 text-white">
            {typeof value === 'number' ? value.toFixed(4) : value}
          </p>
        </motion.div>
      ))}
    </div>
  )
}
