import { useEffect, useRef } from 'react'
import { api } from '../api/client'
import { useStore } from '../store/useStore'

const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000

export function useDecayMonitor() {
  const user = useStore((s) => s.user)
  const setNodes = useStore((s) => s.setNodes)
  const nodes = useStore((s) => s.nodes)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!user?.id) return

    const runDecay = async () => {
      try {
        const res = await api.post('/decay/run')
        const alerts = res.data.alerts || []

        if (alerts.length > 0) {
          const scoresRes = await api.get('/decay/scores')
          const scoreMap = {}
          for (const n of scoresRes.data.nodes) {
            scoreMap[n.id] = n
          }

          setNodes(
            nodes.map((rfNode) => {
              const updated = scoreMap[rfNode.id]
              if (updated) {
                return {
                  ...rfNode,
                  data: {
                    ...rfNode.data,
                    state: updated.state,
                    retention: updated.retention_rt,
                  },
                }
              }
              return rfNode
            })
          )
        }
      } catch (err) {
        console.error('Decay monitor error:', err)
      }
    }

    runDecay()
    intervalRef.current = setInterval(runDecay, POLL_INTERVAL_MS)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [user?.id])
}
