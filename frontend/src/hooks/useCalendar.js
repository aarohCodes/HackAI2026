import { useState, useCallback } from 'react'
import { api } from '../api/client'

export function useCalendar() {
  const [events, setEvents] = useState([])
  const [studyPlan, setStudyPlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  const fetchEvents = useCallback(async (startDate, endDate) => {
    setLoading(true)
    setError(null)
    try {
      const params = {}
      if (startDate) params.start = startDate
      if (endDate) params.end = endDate
      const res = await api.get('/calendar/events', { params })
      setEvents(res.data.events || [])
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load calendar events')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPlan = useCallback(async (weekStart) => {
    try {
      const params = weekStart ? { week_start: weekStart } : {}
      const res = await api.get('/calendar/plan', { params })
      setStudyPlan(res.data.plan)
    } catch {
      setStudyPlan(null)
    }
  }, [])

  const generateSchedule = useCallback(async (hoursPerWeek, hubIds, weekStart) => {
    setGenerating(true)
    setError(null)
    try {
      const res = await api.post(
        '/calendar/schedule',
        {
          hours_per_week: hoursPerWeek,
          hub_ids: hubIds,
          week_start: weekStart,
        },
        { timeout: 120000 }
      )
      setStudyPlan({
        id: res.data.plan_id,
        sessions: res.data.sessions,
        hours_per_week: hoursPerWeek,
        hub_ids: hubIds,
      })
      return res.data
    } catch (err) {
      const msg = err.response?.data?.detail
      const detail = Array.isArray(msg) ? msg[0]?.msg || msg[0] : msg
      setError(detail || err.message || 'Failed to generate schedule')
      return null
    } finally {
      setGenerating(false)
    }
  }, [])

  return {
    events,
    studyPlan,
    loading,
    generating,
    error,
    fetchEvents,
    fetchPlan,
    generateSchedule,
  }
}
