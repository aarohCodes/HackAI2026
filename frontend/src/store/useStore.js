import { create } from 'zustand'
import { getStoredUser, api, ensureGuestAuth } from '../api/client'

const initialUser = getStoredUser()

export const useStore = create((set, get) => ({
  // Auth / User
  user: initialUser,
  token: localStorage.getItem('cognipath_token') || null,
  authReady: !!initialUser,
  setUser: (user) => set({ user }),
  setAuth: (user, token) => set({ user, token, authReady: true }),

  // Auto guest auth on app start
  initAuth: async () => {
    try {
      const user = await ensureGuestAuth()
      set({ user, token: localStorage.getItem('cognipath_token'), authReady: true })
    } catch (err) {
      console.error('Guest auth failed:', err)
      set({ authReady: true })
    }
  },

  // Shared graph data cache
  graphNodes: [],
  graphEdges: [],
  graphLoaded: false,
  graphLoading: false,
  currentTopic: '',
  fetchGraph: async (force = false) => {
    const state = get()
    if (!state.user) return { nodes: [], edges: [] }
    if (state.graphLoaded && !force && state.graphNodes.length > 0) {
      return { nodes: state.graphNodes, edges: state.graphEdges }
    }
    if (state.graphLoading) {
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

  // Search topic — resets graph and generates new one
  searchTopic: async (topic) => {
    const state = get()
    if (!state.user || !topic.trim()) return
    set({ graphLoading: true, graphNodes: [], graphEdges: [], graphLoaded: false, currentTopic: topic })
    try {
      await api.post('/graph/search', { topic })
      // Fetch the new graph
      const res = await api.get('/graph/canvas')
      const nodes = res.data.nodes || []
      const edges = res.data.edges || []
      set({ graphNodes: nodes, graphEdges: edges, graphLoaded: true, graphLoading: false })
      return { nodes, edges }
    } catch (err) {
      console.error('Search failed:', err)
      set({ graphLoading: false })
      return { nodes: [], edges: [] }
    }
  },

  // Sidebar
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}))
