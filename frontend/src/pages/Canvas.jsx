import ReactFlow, {
  Background,
  useNodesState, useEdgesState, ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useEffect, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { Sidebar } from '../components/ui/Sidebar'
import { ConceptNode } from '../components/canvas/ConceptNode'
import { api } from '../api/client'
import { Search, Brain, Loader2, Mic, MicOff } from 'lucide-react'
import { useVoiceInput } from '../hooks/useVoiceInput'

const nodeTypes = { concept: ConceptNode }

function Canvas() {
  const navigate = useNavigate()
  const { user, sidebarOpen, fetchGraph, searchTopic, graphLoading, currentTopic } = useStore()
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([])
  const [allNodes, setAllNodes] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [searching, setSearching] = useState(false)

  // Voice input via ElevenLabs STT
  const { isRecording, isTranscribing, toggleRecording, error: voiceError } = useVoiceInput(
    (text) => setSearchInput((prev) => (prev ? prev + ' ' + text : text))
  )

  const loadGraph = useCallback(({ nodes: nodesData, edges: edgesData }) => {
    setAllNodes(nodesData)
    setRfNodes(
      nodesData.map((n) => ({
        id: String(n.id),
        type: 'concept',
        position: { x: n.canvas_x, y: n.canvas_y },
        data: {
          concept: n.concept,
          state: n.state,
          mode: n.mode,
          retention: n.retention_rt,
          importance: n.complexity_tier,
          nodeId: n.id,
        },
      }))
    )
    setRfEdges(
      (edgesData || []).map((e) => ({
        id: `${e.from_node_id}-${e.to_node_id}`,
        source: String(e.from_node_id),
        target: String(e.to_node_id),
        type: 'smoothstep',
        style: {
          stroke: e.edge_type === 'prerequisite' ? '#4B5563' : '#1E3A5F',
          strokeWidth: 1.5,
        },
        animated: e.edge_type === 'prerequisite',
      }))
    )
  }, [setRfNodes, setRfEdges])

  useEffect(() => {
    if (!user) return
    fetchGraph().then((data) => {
      if (data.nodes.length > 0) loadGraph(data)
    }).catch((err) => console.error('Failed to load graph:', err))
  }, [user])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchInput.trim() || searching) return
    setSearching(true)
    try {
      const data = await searchTopic(searchInput.trim())
      if (data && data.nodes.length > 0) loadGraph(data)
      setSearchInput('')
    } catch (err) {
      console.error('Search failed:', err)
    }
    setSearching(false)
  }

  const onNodeDragStop = useCallback(
    (_, node) => {
      api.patch(`/graph/node/${node.id}/position`, { x: node.position.x, y: node.position.y })
    },
    []
  )

  const onNodeClick = useCallback((_, node) => {
    navigate(`/learn/${node.id}`)
  }, [navigate])

  const knowledgeDepth = allNodes.length > 0
    ? Math.round((allNodes.filter(n => n.state === 'green').length / allNodes.length) * 100)
    : 0

  const hasGraph = allNodes.length > 0

  return (
    <div className="h-screen bg-cogni-bg overflow-hidden flex">
      <Sidebar />

      <div
        className="flex-1 flex flex-col h-full transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? 224 : 72 }}
      >
        {/* Top bar with search */}
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-white/5 flex-shrink-0 bg-cogni-bg/80 backdrop-blur-xl z-20">
          <div className="flex items-center gap-4">
            <span className="font-display font-bold text-sm">
              <span className="text-cogni-accent">Knowledge Graph</span>
            </span>
            {hasGraph && (
              <span className="text-xs text-white/30">
                {allNodes.length} concepts &middot; {allNodes.filter(n => n.state === 'green').length} mastered
              </span>
            )}
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="flex items-center bg-white/[0.04] border border-white/10 rounded-xl px-3 py-1.5 gap-2 focus-within:border-cogni-accent/40 transition-colors">
              <Search size={14} className="text-white/30 flex-shrink-0" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search any topic..."
                className="bg-transparent text-sm text-white placeholder-white/30 outline-none w-56"
                disabled={searching}
              />
              {(searching || isTranscribing) && (
                <Loader2 size={14} className="text-cogni-accent animate-spin flex-shrink-0" />
              )}
              <button
                type="button"
                onClick={toggleRecording}
                disabled={searching || isTranscribing}
                className={`flex-shrink-0 p-0.5 rounded-lg transition-all ${
                  isRecording
                    ? 'text-red-400 animate-pulse'
                    : 'text-white/30 hover:text-cogni-accent'
                } disabled:opacity-30`}
                title={isRecording ? 'Stop recording' : 'Voice search'}
              >
                {isRecording ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={!searchInput.trim() || searching}
              className="px-3 py-1.5 rounded-xl bg-cogni-accent text-white text-sm font-semibold disabled:opacity-30 hover:bg-cogni-accent/80 transition-colors"
            >
              Go
            </button>
          </form>
        </div>

        {/* Graph area or empty state */}
        <div className="flex-1 relative">
          {!hasGraph && !searching ? (
            /* Empty state — prompt user to search */
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-cogni-accent/20 to-cogni-teal/20 flex items-center justify-center mb-6">
                  <Brain size={36} className="text-cogni-accent" />
                </div>
                <h2 className="font-display font-bold text-2xl mb-3">
                  What do you want to{' '}
                  <span className="bg-gradient-to-r from-cogni-accent to-cogni-teal bg-clip-text text-transparent">
                    learn
                  </span>
                  ?
                </h2>
                <p className="text-white/40 mb-8">
                  Search for any topic and we'll generate a personalized knowledge graph for you.
                </p>
                <form onSubmit={handleSearch} className="flex items-center gap-2 max-w-sm mx-auto">
                  <div className="flex-1 flex items-center bg-cogni-card border border-cogni-border rounded-xl px-4 py-3 gap-3">
                    <Search size={18} className="text-white/30 flex-shrink-0" />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="e.g. Machine Learning, React, Finance..."
                      className="flex-1 bg-transparent text-white placeholder-white/30 outline-none text-sm"
                    />
                    {isTranscribing && (
                      <Loader2 size={16} className="text-cogni-accent animate-spin flex-shrink-0" />
                    )}
                    <button
                      type="button"
                      onClick={toggleRecording}
                      disabled={isTranscribing}
                      className={`flex-shrink-0 p-1 rounded-lg transition-all ${
                        isRecording
                          ? 'text-red-400 animate-pulse'
                          : 'text-white/30 hover:text-cogni-accent'
                      } disabled:opacity-30`}
                      title={isRecording ? 'Stop recording' : 'Voice search'}
                    >
                      {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={!searchInput.trim()}
                    className="px-5 py-3 rounded-xl bg-gradient-to-r from-cogni-accent to-cogni-teal text-white font-bold text-sm disabled:opacity-30 hover:shadow-lg hover:shadow-cogni-accent/20 transition-all"
                  >
                    Go
                  </button>
                </form>
              </div>
            </div>
          ) : searching || graphLoading ? (
            /* Loading state */
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 size={48} className="mx-auto text-cogni-accent animate-spin" />
                <p className="mt-4 text-white/50 font-semibold">
                  Generating knowledge graph for "{currentTopic || searchInput}"...
                </p>
                <p className="text-xs text-white/25 mt-1">This may take a few seconds</p>
              </div>
            </div>
          ) : (
            <>
              {/* Stats overlay */}
              <div className="px-4 pt-3 z-10 absolute top-0 left-0">
                <div className="p-3 rounded-xl bg-cogni-card/90 backdrop-blur-sm border border-cogni-border max-w-[220px]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-2">Progress</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/40">Mastery</span>
                      <span className="text-[10px] font-bold text-cogni-teal">{knowledgeDepth}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-cogni-teal" style={{ width: `${knowledgeDepth}%` }} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/40">Connections</span>
                      <span className="text-[10px] font-bold text-cogni-accent">{rfEdges.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="px-4 pt-3 z-10 absolute top-0 right-0">
                <div className="p-2.5 rounded-xl bg-cogni-card/90 backdrop-blur-sm border border-cogni-border flex gap-3">
                  {[
                    { label: 'Mastered', color: '#10B981' },
                    { label: 'In Progress', color: '#F59E0B' },
                    { label: 'To Learn', color: '#EF4444' },
                  ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                      <span className="text-[9px] text-white/40">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-full h-full">
                <ReactFlowProvider>
                  <ReactFlow
                    nodes={rfNodes} edges={rfEdges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeDragStop={onNodeDragStop}
                    onNodeClick={onNodeClick}
                    nodeTypes={nodeTypes}
                    nodesConnectable={false}
                    fitView minZoom={0.1} maxZoom={2}
                    proOptions={{ hideAttribution: true }}
                  >
                    <Background color="#1E2A3A" gap={40} size={1} />
                  </ReactFlow>
                </ReactFlowProvider>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export function CanvasPage() {
  return <Canvas />
}
