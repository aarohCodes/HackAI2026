import ReactFlow, {
  Background,
  useNodesState, useEdgesState, ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useEffect, useCallback, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import { Sidebar } from '../components/ui/Sidebar'
import { ConceptNode } from '../components/canvas/ConceptNode'
import { RecommendationCard } from '../components/canvas/RecommendationCard'
import { TimelineScrubber } from '../components/canvas/TimelineScrubber'
import { FeynmanChallenge } from '../components/learning/FeynmanChallenge'
import { SocraticDebate } from '../components/learning/SocraticDebate'
import { QuickSnapshot } from '../components/learning/QuickSnapshot'
import { VideoSnippet } from '../components/learning/VideoSnippet'
import { useGamification } from '../hooks/useGamification'
import { api } from '../api/client'
import {
  Brain, Sparkles, Play, BookOpen, ZoomIn, ZoomOut, Maximize,
  Send, Globe,
} from 'lucide-react'

const nodeTypes = { concept: ConceptNode }

function Canvas() {
  const navigate = useNavigate()
  const location = useLocation()
  const filterDomain = location.state?.domain || null
  const {
    user, sidebarOpen,
    activeRecommendation, activeLearningMode,
    isHistoricalView, setLearningMode, fetchGraph,
  } = useStore()
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([])
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([])
  const [allNodes, setAllNodes] = useState([])
  const [selectedNode, setSelectedNode] = useState(null)
  const [geminiChat, setGeminiChat] = useState('')
  const [geminiMessages, setGeminiMessages] = useState([])
  const [geminiLoading, setGeminiLoading] = useState(false)
  const [recommendation, setRecommendation] = useState(null)
  const [webResources, setWebResources] = useState([])
  const [resourcesLoading, setResourcesLoading] = useState(false)

  useGamification()

  // Load graph from cached store
  useEffect(() => {
    if (!user) return
    fetchGraph().then(({ nodes: rawNodes, edges: rawEdges }) => {
      const nodesData = filterDomain
        ? rawNodes.filter((n) => n.domain === filterDomain)
        : rawNodes
      const nodeIdSet = new Set(nodesData.map((n) => String(n.id)))
      const edgesData = (rawEdges || []).filter(
        (e) => nodeIdSet.has(String(e.from_node_id)) && nodeIdSet.has(String(e.to_node_id))
      )
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
            recommendation: n.active_recommendation ?? null,
            nodeId: n.id,
          },
        }))
      )
      setRfEdges(
        edgesData.map((e) => ({
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
      const activeNode = nodesData.find((n) => n.state === 'fading' || n.state === 'glow') || nodesData[0]
      if (activeNode) {
        setSelectedNode(activeNode)
        fetchRecommendation(activeNode.id)
        fetchResources(activeNode.concept)
      }
    }).catch((err) => console.error('Failed to load graph:', err))
  }, [user, filterDomain])

  // POST /api/gemini/recommend with node_ids
  const fetchRecommendation = async (nodeId) => {
    try {
      const res = await api.post('/gemini/recommend', { node_ids: [nodeId] })
      if (res.data.recommendation) {
        setRecommendation(res.data.recommendation)
      }
    } catch (err) {
      console.error('Recommendation fetch failed:', err)
      setRecommendation(null)
    }
  }

  // PATCH /api/graph/node/{id}/position
  const onNodeDragStop = useCallback(
    (_, node) => {
      if (isHistoricalView) return
      api.patch(`/graph/node/${node.id}/position`, { x: node.position.x, y: node.position.y })
    },
    [isHistoricalView]
  )

  const fetchResources = async (concept) => {
    setResourcesLoading(true)
    try {
      const res = await api.post('/search/search', { query: concept + ' tutorial' })
      setWebResources((res.data.web_results || []).slice(0, 2))
    } catch {
      setWebResources([])
    }
    setResourcesLoading(false)
  }

  const onNodeClick = useCallback((_, node) => {
    const fullNode = allNodes.find((n) => String(n.id) === node.id)
    if (fullNode) {
      setSelectedNode(fullNode)
      setRecommendation(null)
      setWebResources([])
      fetchRecommendation(fullNode.id)
      fetchResources(fullNode.concept)
    }
  }, [allNodes])

  // POST /api/gemini/recommend for chat context
  const handleGeminiSend = async () => {
    if (!geminiChat.trim() || geminiLoading) return
    const msg = geminiChat.trim()
    setGeminiChat('')
    setGeminiMessages((prev) => [...prev, { role: 'user', content: msg }])
    setGeminiLoading(true)
    try {
      const res = await api.post('/gemini/recommend', { node_ids: selectedNode ? [selectedNode.id] : [] })
      const rec = res.data.recommendation
      setGeminiMessages((prev) => [
        ...prev,
        { role: 'gemini', content: rec?.gemini_reasoning || rec?.practice_scenario || 'No recommendation available.' },
      ])
    } catch {
      setGeminiMessages((prev) => [...prev, { role: 'gemini', content: 'Unable to get response. Please try again.' }])
    }
    setGeminiLoading(false)
  }

  // POST /api/youtube/snippet with proper schema
  const handleWatchVideo = async () => {
    if (!selectedNode) return
    const concept = selectedNode.concept
    try {
      const res = await api.post('/youtube/snippet', {
        concept,
        gap_description: recommendation?.gemini_reasoning || `Learning ${concept}`,
        youtube_query: `${concept} tutorial explained`,
        timestamp_hint: 'key explanation section',
        recommendation_id: recommendation?.id || undefined,
      })
      navigate(`/video/${selectedNode.id}`, {
        state: { snippet: res.data.snippet, node: selectedNode, recommendation },
      })
    } catch {
      navigate(`/video/${selectedNode.id}`, {
        state: { snippet: null, node: selectedNode, recommendation },
      })
    }
  }

  const knowledgeDepth = allNodes.length > 0
    ? Math.round((allNodes.reduce((s, n) => s + (n.retention_rt || 0), 0) / allNodes.length) * 100)
    : 0

  return (
    <div className="h-screen bg-cogni-bg overflow-hidden flex">
      {/* App sidebar — stays connected */}
      <Sidebar />

      {/* Main content area */}
      <div
        className="flex-1 flex flex-col h-full transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? 224 : 72 }}
      >
        {/* Thin top bar */}
        <div className="flex items-center justify-between px-6 py-2.5 border-b border-white/5 flex-shrink-0 bg-cogni-bg/80 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <span className="font-display font-bold text-sm">
              <span className="text-cogni-accent">Hub Explorer</span>
              {filterDomain && (
                <span className="text-white/40 ml-2 text-xs font-normal">
                  / {filterDomain.replace(/_/g, ' ')}
                  <button onClick={() => navigate('/canvas', { replace: true })} className="ml-2 text-cogni-teal hover:text-white text-[10px]">Show All</button>
                </span>
              )}
            </span>
            {filterDomain && (
              <button
                onClick={() => navigate(`/hubs/${encodeURIComponent(filterDomain)}`)}
                className="text-xs text-cogni-teal hover:text-white transition-colors ml-4"
              >
                Back to Sub-Hub
              </button>
            )}
          </div>
          {selectedNode && (
            <span className="text-xs text-white/30">
              Viewing: <span className="text-white/60 font-semibold">{selectedNode.concept}</span>
            </span>
          )}
        </div>

        {/* Main row: Graph + Gemini sidebar */}
        <div className="flex-1 flex overflow-hidden">
          {/* Graph area */}
          <div className="flex-1 flex flex-col relative">
            {/* Stats overlay */}
            <div className="px-4 pt-3 z-10 absolute top-0 left-0">
              <div className="p-3 rounded-xl bg-cogni-card/90 backdrop-blur-sm border border-cogni-border max-w-[220px]">
                <p className="text-[9px] text-white/40 mb-1">
                  Learning Path &gt; <span className="text-white/50">{selectedNode?.domain?.replace(/_/g, ' ') || 'Cluster'}</span>
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/50 mb-2">Node Statistics</p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/40">Knowledge Depth</span>
                    <span className="text-[10px] font-bold text-cogni-teal">{knowledgeDepth}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-cogni-teal" style={{ width: `${knowledgeDepth}%` }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/40">Connections</span>
                    <span className="text-[10px] font-bold text-cogni-accent">{rfEdges.length} Nodes</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1">
              <ReactFlowProvider>
                <ReactFlow
                  nodes={rfNodes} edges={rfEdges}
                  onNodesChange={isHistoricalView ? undefined : onNodesChange}
                  onEdgesChange={isHistoricalView ? undefined : onEdgesChange}
                  onNodeDragStop={onNodeDragStop}
                  onNodeClick={onNodeClick}
                  nodeTypes={nodeTypes}
                  nodesDraggable={!isHistoricalView}
                  nodesConnectable={false}
                  fitView minZoom={0.1} maxZoom={2}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background color="#1E2A3A" gap={40} size={1} />
                </ReactFlow>
              </ReactFlowProvider>
              <div className="absolute left-4 bottom-4 flex flex-col gap-2 z-10">
                {[ZoomIn, ZoomOut, Maximize].map((Icon, i) => (
                  <button key={i} className="w-8 h-8 rounded-xl bg-cogni-card/80 border border-cogni-border flex items-center justify-center text-white/40 hover:text-white transition-colors"><Icon size={14} /></button>
                ))}
              </div>
            </div>

            {/* Bottom stats bar */}
            <div className="flex items-center justify-center gap-6 py-2.5 border-t border-white/5 flex-shrink-0 bg-cogni-bg/80 backdrop-blur-xl">
              <span className="text-[10px] text-white/30">
                <span className="text-cogni-success font-bold">{allNodes.filter((n) => n.state === 'green').length}</span> mastered
              </span>
              <span className="text-[10px] text-white/30">
                <span className="text-cogni-warning font-bold">{allNodes.filter((n) => n.state === 'yellow').length}</span> in progress
              </span>
              <span className="text-[10px] text-white/30">
                <span className="text-cogni-danger font-bold">{allNodes.filter((n) => n.state === 'red').length}</span> to learn
              </span>
              <span className="text-[10px] text-white/30">
                <span className="font-bold text-cogni-accent">{allNodes.length}</span> total
              </span>
            </div>
          </div>

          {/* Gemini Sidebar */}
          <div className="w-72 border-l border-white/5 flex flex-col bg-cogni-card/20 flex-shrink-0">
            <div className="px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cogni-accent to-cogni-teal flex items-center justify-center">
                  <Sparkles size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-xs">Gemini AI</h3>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-cogni-teal">Active</p>
                </div>
              </div>
            </div>

            {/* Mission */}
            <div className="px-4 py-3">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Brain size={12} className="text-cogni-accent" />
                  <span className="text-[10px] font-bold">Daily Mission</span>
                </div>
                {recommendation ? (
                  <p className="text-xs text-white/50 mb-3 leading-relaxed">
                    {(recommendation.gemini_reasoning || '').slice(0, 100)}
                    {(recommendation.gemini_reasoning || '').length > 100 ? '...' : ''}
                  </p>
                ) : (
                  <p className="text-xs text-white/30 mb-3">Select a node to load mission...</p>
                )}
                <button
                  onClick={() => selectedNode && setLearningMode('teach', { concept: selectedNode.concept, nodeId: selectedNode.id })}
                  className="w-full py-2 rounded-lg bg-cogni-accent hover:bg-cogni-accent-light text-white text-xs font-semibold transition-all"
                >
                  Start Mission
                </button>
              </div>
            </div>

            {/* Resources */}
            <div className="px-4 py-1">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/25 mb-2">Resources</p>
              <div className="space-y-1.5">
                <button onClick={() => selectedNode && setLearningMode('teach', { concept: selectedNode.concept, nodeId: selectedNode.id })}
                  className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/15 transition-all text-left">
                  <BookOpen size={14} className="text-white/30 flex-shrink-0" />
                  <span className="text-xs text-white/50">Concept Documentation</span>
                </button>
                <button onClick={handleWatchVideo}
                  className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/15 transition-all text-left">
                  <Play size={14} className="text-white/30 flex-shrink-0" />
                  <span className="text-xs text-white/50">Watch Video Snippet</span>
                </button>
                {selectedNode && (
                  <button onClick={() => navigate(`/learn/${selectedNode.id}`)}
                    className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-cogni-accent/[0.08] border border-cogni-accent/20 hover:border-cogni-accent/40 transition-all text-left">
                    <Sparkles size={14} className="text-cogni-accent flex-shrink-0" />
                    <span className="text-xs text-cogni-accent/80">Full Resource Page</span>
                  </button>
                )}
                {selectedNode && resourcesLoading && (
                  <div className="flex items-center gap-2 p-2.5 text-xs text-white/30">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }} className="w-3 h-3 border border-white/20 border-t-cogni-accent rounded-full" />
                    Finding resources...
                  </div>
                )}
                {webResources.map((r, i) => (
                  <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                    className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/15 transition-all text-left">
                    <Globe size={14} className="text-white/30 flex-shrink-0" />
                    <span className="text-xs text-white/50 truncate">{r.title}</span>
                  </a>
                ))}
                {selectedNode && !resourcesLoading && webResources.length === 0 && (
                  <a href={`https://www.google.com/search?q=${encodeURIComponent(selectedNode.concept + ' tutorial')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:border-white/15 transition-all text-left">
                    <Globe size={14} className="text-white/30 flex-shrink-0" />
                    <span className="text-xs text-white/50">Web Resources</span>
                  </a>
                )}
              </div>
            </div>

            {/* Chat */}
            <div className="flex-1 flex flex-col px-4 py-2 min-h-0">
              <div className="flex-1 overflow-y-auto space-y-1.5 mb-2">
                {geminiMessages.map((msg, i) => (
                  <motion.div key={i} initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                    className={`text-[11px] p-2.5 rounded-lg ${msg.role === 'user' ? 'bg-cogni-accent/15 border border-cogni-accent/20 ml-3' : 'bg-white/[0.03] border border-white/[0.06] mr-3'}`}>
                    <p className="text-white/60 leading-relaxed">{msg.content}</p>
                  </motion.div>
                ))}
                {geminiLoading && (
                  <div className="flex gap-1 p-2">
                    {[0, 1, 2].map((i) => (
                      <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} className="w-1.5 h-1.5 rounded-full bg-white/25" />
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <input value={geminiChat} onChange={(e) => setGeminiChat(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGeminiSend()}
                  placeholder="Ask Gemini..."
                  className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-[11px] text-white placeholder-white/20 outline-none focus:border-cogni-accent/30" />
                <button onClick={handleGeminiSend} disabled={!geminiChat.trim() || geminiLoading}
                  className="w-7 h-7 rounded-lg bg-cogni-accent flex items-center justify-center text-white disabled:opacity-30">
                  <Send size={10} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overlays */}
      {activeRecommendation && <RecommendationCard />}
      {activeLearningMode === 'teach' && <FeynmanChallenge />}
      {activeLearningMode === 'defend' && <SocraticDebate />}
      {activeLearningMode === 'quick' && <QuickSnapshot />}
      {activeLearningMode === 'snippet' && <VideoSnippet />}

      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[100]">
        <TimelineScrubber />
      </div>
    </div>
  )
}

export function CanvasPage() {
  return <Canvas />
}
