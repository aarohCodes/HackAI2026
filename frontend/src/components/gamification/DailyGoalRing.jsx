import { motion } from 'framer-motion'

export function DailyGoalRing({ current, goal }) {
  const pct = Math.min(100, Math.round((current / Math.max(goal, 1)) * 100))
  const radius = 32
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference

  return (
    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
      <div className="flex items-center gap-3">
        <div className="relative w-[76px] h-[76px] flex-shrink-0">
          <svg viewBox="0 0 76 76" className="w-full h-full -rotate-90">
            <circle
              cx="38" cy="38" r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="5"
            />
            <motion.circle
              cx="38" cy="38" r={radius}
              fill="none"
              stroke="url(#goalGradient)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
            <defs>
              <linearGradient id="goalGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#2DD4BF" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-white">{pct}%</span>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-cogni-accent">Daily Goal</p>
          <p className="text-xs text-white/60 mt-0.5">
            {current.toLocaleString()} / {goal.toLocaleString()} XP
          </p>
        </div>
      </div>
    </div>
  )
}
