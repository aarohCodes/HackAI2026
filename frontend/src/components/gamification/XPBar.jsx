import { motion } from 'framer-motion'
import { useStore } from '../../store/useStore'

export function XPBar() {
  const { gamification } = useStore()
  const { xp, level, levelTitle } = gamification

  const levelThresholds = [
    0, 100, 250, 450, 700, 1001, 1400, 1900, 2500, 3000,
    3500, 4200, 5000, 5900, 6900, 8001, 9200, 10500, 12000, 13500,
    15000, 18001, 24000, 26000, 30000, 35001, 38000, 45000, 60000,
  ]

  let currentThreshold = 0
  let nextThreshold = 100
  for (let i = 0; i < levelThresholds.length; i++) {
    if (xp >= levelThresholds[i]) {
      currentThreshold = levelThresholds[i]
      nextThreshold = levelThresholds[i + 1] || currentThreshold + 5000
    }
  }

  const xpInLevel = xp - currentThreshold
  const xpNeeded = nextThreshold - currentThreshold
  const pct = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100))

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cogni-accent to-cogni-accent-light flex items-center justify-center text-xs font-bold flex-shrink-0">
          {level}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-cogni-accent">{levelTitle}</p>
          <div className="w-24 h-1.5 rounded-full bg-white/10 mt-1 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-cogni-accent to-cogni-teal"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
          <p className="text-[9px] text-white/40 mt-0.5">{xpInLevel} / {xpNeeded} XP</p>
        </div>
      </div>
    </div>
  )
}
