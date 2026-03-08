import { create } from 'zustand'
import { getStoredUser, api } from '../api/client'

const initialUser = getStoredUser()

export const useStore = create((set, get) => ({
  // Auth / User
  user: initialUser,
  token: localStorage.getItem('cognipath_token') || null,
  setUser: (user) => set({ user }),
  setAuth: (user, token) => set({ user, token }),
  logout: () => {
    localStorage.removeItem('cognipath_token')
    localStorage.removeItem('cognipath_user')
    set({ user: null, token: null, graphNodes: [], graphEdges: [], graphLoaded: false })
  },

  // Canvas nodes + edges (React Flow format)
  nodes: [],
  edges: [],
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  // Shared graph data cache (raw from API, used by Dashboard, Hubs, Canvas)
  graphNodes: [],
  graphEdges: [],
  graphLoaded: false,
  graphLoading: false,
  fetchGraph: async (force = false) => {
    const state = get()
    if (!state.user) return { nodes: [], edges: [] }
    if (state.graphLoaded && !force && state.graphNodes.length > 0) {
      return { nodes: state.graphNodes, edges: state.graphEdges }
    }
    if (state.graphLoading) {
      // Wait for in-flight request
      return new Promise((resolve) => {
        const unsub = useStore.subscribe((s) => {
          if (!s.graphLoading) {
            unsub()
            resolve({ nodes: s.graphNodes, edges: s.graphEdges })
          }
        })
      })
    }
    set({ graphLoading: true })
    try {
      const res = await api.get('/graph/canvas')
      const nodes = res.data.nodes || []
      const edges = res.data.edges || []
      set({ graphNodes: nodes, graphEdges: edges, graphLoaded: true, graphLoading: false })
      return { nodes, edges }
    } catch (err) {
      console.error('Failed to fetch graph:', err)
      set({ graphLoading: false })
      return { nodes: get().graphNodes, edges: get().graphEdges }
    }
  },
  invalidateGraph: () => set({ graphLoaded: false }),

  // Active recommendation overlay
  activeRecommendation: null,
  setActiveRecommendation: (rec) => set({ activeRecommendation: rec }),
  clearRecommendation: () => set({ activeRecommendation: null }),

  // Active learning modal
  activeLearningMode: null,
  activeConcept: null,
  setLearningMode: (mode, concept) =>
    set({ activeLearningMode: mode, activeConcept: concept }),
  clearLearningMode: () =>
    set({ activeLearningMode: null, activeConcept: null }),

  // Timeline scrubber
  timelineDate: null,
  isHistoricalView: false,
  setTimelineDate: (d) =>
    set({ timelineDate: d, isHistoricalView: d !== null }),

  // ML Metrics
  metrics: null,
  setMetrics: (m) => set({ metrics: m }),

  // Gamification
  gamification: {
    xp: 0,
    level: 1,
    levelTitle: 'Novice',
    streakDays: 0,
    dailyXp: 0,
    dailyXpGoal: 500,
    achievements: [],
    recentXpGain: null,
  },
  setGamification: (g) =>
    set((s) => ({ gamification: { ...s.gamification, ...g } })),
  addXp: (amount, source) =>
    set((s) => ({
      gamification: {
        ...s.gamification,
        xp: s.gamification.xp + amount,
        dailyXp: s.gamification.dailyXp + amount,
        recentXpGain: { amount, source, timestamp: Date.now() },
      },
    })),

  // Sidebar
  sidebarOpen: true,
  activePage: 'dashboard',
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActivePage: (page) => set({ activePage: page }),
}))
