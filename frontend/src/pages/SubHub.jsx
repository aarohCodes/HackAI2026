import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import { Sidebar } from '../components/ui/Sidebar'
import { api } from '../api/client'
import { ArrowLeft, Plus, Eye, ChevronRight } from 'lucide-react'

const STATE_BADGE = {
  green: { label: 'Completed', bg: 'bg-cogni-success/20', text: 'text-cogni-success', bar: 'bg-cogni-success' },
  yellow: { label: 'In Progress', bg: 'bg-cogni-warning/20', text: 'text-cogni-warning', bar: 'bg-cogni-warning' },
  red: { label: 'Not Started', bg: 'bg-cogni-danger/20', text: 'text-cogni-danger', bar: 'bg-cogni-danger' },
}

function formatLabel(str) {
  return str.replace(/_/g, ' ').split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export function SubHubPage() {
  const { domain } = useParams()
  const decodedDomain = decodeURIComponent(domain)
  const navigate = useNavigate()
  const { user, sidebarOpen, fetchGraph } = useStore()

  const [nodes, setNodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTopic, setNewTopic] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState(null)

  useEffect(() => {
    if (!user) return
    fetchGraph().then(({ nodes: all }) => {
      setNodes(all.filter((n) => n.domain === decodedDomain))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user, decodedDomain])

  const handleAddTopic = async () => {
    if (!newTopic.trim() || adding) return
    setAdding(true)
    setAddError(null)
    try {
      await api.post('/graph/add-topic', { topic: newTopic.trim() })
      const { nodes: all } = await fetchGraph(true)
      setNodes(all.filter((n) => n.domain === decodedDomain))
      setNewTopic('')
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to add topic.'
      setAddError(Array.isArray(msg) ? msg.join(' ') : msg)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#060B18]">
      <Sidebar />
      <div
        className="min-h-screen transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? 224 : 72 }}
      >
        <div className="max-w-6xl mx-auto px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/hubs')}
                className="w-10 h-10 rounded-xl bg-[#0B1628] border border-[#1A2744] flex items-center justify-center text-[#5B7BA3] hover:text-white hover:border-cogni-accent/30 transition-all"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-cogni-accent mb-1">Hub Explorer</p>
                <h1 className="text-2xl font-display font-bold text-white">{formatLabel(decodedDomain)}</h1>
                <p className="text-sm text-[#5B7BA3] mt-0.5">{nodes.length} sub-topics</p>
              </div>
            </div>

            <button
              onClick={() => navigate('/canvas', { state: { domain: decodedDomain } })}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cogni-accent/10 border border-cogni-accent/30 text-cogni-accent hover:bg-cogni-accent/20 transition-all text-sm font-semibold"
            >
              <Eye size={16} />
              View Graph
            </button>
          </div>

          {/* Add Sub-topic */}
          <div className="flex gap-3 mb-8">
            <div className="flex-1 flex items-center bg-[#0B1628] border border-[#1A2744] rounded-xl px-4 py-3 gap-2 focus-within:border-cogni-accent/40 transition-colors">
              <Plus size={16} className="text-[#3D5A80] flex-shrink-0" />
              <input
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTopic()}
                placeholder="Add a new sub-topic..."
                className="bg-transparent text-sm text-white placeholder-[#3D5A80] outline-none flex-1"
              />
            </div>
            <button
              onClick={handleAddTopic}
              disabled={!newTopic.trim() || adding}
              className="px-6 py-3 rounded-xl bg-cogni-accent text-white text-sm font-semibold hover:bg-cogni-accent/80 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-cogni-accent/20"
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
          {addError && (
            <p className="mt-2 text-sm text-amber-400">{addError}</p>
          )}

          {/* Loading */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-8 h-8 border-2 border-[#1A2744] border-t-cogni-accent rounded-full"
              />
            </div>
          ) : nodes.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[#5B7BA3] text-lg">No sub-topics in this hub yet.</p>
              <p className="text-[#3D5A80] text-sm mt-2">Add a topic above to get started.</p>
            </div>
          ) : (
            /* Sub-topic grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {nodes.map((node, i) => {
                const badge = STATE_BADGE[node.state] || STATE_BADGE.red
                const mastery = Math.round((node.mastery_score || 0) * 100)

                return (
                  <motion.div
                    key={node.id || node._id}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => navigate(`/learn/${node.id || node._id}`)}
                    className="p-5 rounded-2xl bg-[#0B1628] border border-[#1A2744] hover:border-cogni-accent/30 cursor-pointer transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-display font-bold text-white group-hover:text-cogni-accent transition-colors leading-tight">
                        {formatLabel(node.concept)}
                      </h3>
                      <ChevronRight size={16} className="text-[#3D5A80] group-hover:text-cogni-accent transition-colors flex-shrink-0 mt-0.5" />
                    </div>

                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${badge.bg} ${badge.text}`}>
                      {badge.label}
                    </span>

                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-[#5B7BA3] uppercase tracking-wider font-semibold">Mastery</span>
                        <span className="text-xs font-bold text-white">{mastery}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#1A2744] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${mastery}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className={`h-full rounded-full ${badge.bar}`}
                        />
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
