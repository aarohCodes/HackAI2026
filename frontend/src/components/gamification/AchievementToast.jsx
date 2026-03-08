import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'

export function AchievementToast({ achievement, onDismiss }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      onDismiss?.()
    }, 5000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -80, opacity: 0, scale: 0.8 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -80, opacity: 0, scale: 0.8 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-4 rounded-2xl bg-cogni-card border border-cogni-accent/40 shadow-2xl shadow-cogni-accent/20 flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cogni-accent to-cogni-warning flex items-center justify-center">
            <Trophy size={24} className="text-white" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-cogni-accent">
              Achievement Unlocked!
            </p>
            <p className="text-white font-semibold mt-0.5">
              {achievement?.icon} {achievement?.name}
            </p>
            <p className="text-xs text-white/50">{achievement?.description}</p>
          </div>
          <div className="ml-4 text-right">
            <p className="text-sm font-bold text-cogni-teal">+{achievement?.xp_reward} XP</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
