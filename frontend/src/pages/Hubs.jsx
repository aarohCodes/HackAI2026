import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useParams } from 'react-router-dom'
import { Sidebar } from '../components/ui/Sidebar'
import { useStore } from '../store/useStore'
import { useGamification } from '../hooks/useGamification'
import {
  Search, Bell, Plus, Minus, Navigation,
  Brain, Code, Palette, Server, ChevronRight,
} from 'lucide-react'

const HUB_ICONS = {
  machine_learning: Brain,
  data_science: Brain,
  web_development: Code,
  ui_ux: Palette,
  backend: Server,
  default: Brain,
}

export function HubsPage() {
  const navigate = useNavigate()
  const { topic: topicParam } = useParams()
  const { user, sidebarOpen, gamification, fetchGraph } = useStore()
  const [nodes, setNodes] = useState([])
  const [view, setView] = useState('network')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Canvas pan & zoom state
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [dragHub, setDragHub] = useState(null)
  const [hubPositions, setHubPositions] = useState({})
  const canvasRef = useRef(null)

  useGamification()

  useEffect(() => {
    if (!user) return
    fetchGraph().then(({ nodes: n }) => {
      setNodes(n)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user])

  const hubs = useMemo(() => {
    const grouped = {}
    for (const node of nodes) {
      const domain = node.domain || 'general'
      if (!grouped[domain]) {
        grouped[domain] = { domain, nodes: [], totalRetention: 0 }
      }
      grouped[domain].nodes.push(node)
      grouped[domain].totalRetention += (node.retention_rt || 0)
    }
    return Object.values(grouped).map((hub) => ({
      ...hub,
      mastery: hub.nodes.length > 0
        ? Math.round((hub.totalRetention / hub.nodes.length) * 100)
        : 0,
    })).sort((a, b) => b.nodes.length - a.nodes.length)
  }, [nodes])

  // Initialize hub positions once hubs are computed
  useEffect(() => {
    if (hubs.length === 0) return
    const rect = canvasRef.current?.getBoundingClientRect()
    const w = rect?.width || 900
    const h = rect?.height || 600

    const defaultPositions = [
      { x: w * 0.28, y: h * 0.42 },
      { x: w * 0.62, y: h * 0.32 },
      { x: w * 0.74, y: h * 0.62 },
      { x: w * 0.42, y: h * 0.72 },
      { x: w * 0.18, y: h * 0.68 },
      { x: w * 0.52, y: h * 0.52 },
    ]

    setHubPositions((prev) => {
      const next = { ...prev }
      hubs.forEach((hub, i) => {
        if (!next[hub.domain]) {
          const dp = defaultPositions[i] || { x: 200 + (i * 150) % (w * 0.6), y: 150 + (i * 130) % (h * 0.5) }
          next[hub.domain] = dp
        }
      })
      return next
    })
  }, [hubs])

  const totalMastery = nodes.length > 0
    ? Math.round((nodes.reduce((sum, n) => sum + (n.retention_rt || 0), 0) / nodes.length) * 100)
    : 0

  const topicDomain = topicParam
    ? decodeURIComponent(topicParam).toLowerCase().replace(/\s+/g, '_')
    : null

  const filteredHubs = useMemo(() => {
    let result = hubs
    if (topicDomain) {
      result = result.filter((h) =>
        h.domain.toLowerCase().includes(topicDomain) || topicDomain.includes(h.domain.toLowerCase())
      )
    }
    if (search) {
      result = result.filter((h) => h.domain.toLowerCase().includes(search.toLowerCase()))
    }
    return result
  }, [hubs, topicDomain, search])

  const formatLabel = (domain) =>
    domain.replace(/_/g, ' ').split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  // Canvas mouse handlers for pan
  const handleCanvasMouseDown = useCallback((e) => {
    if (e.target === canvasRef.current || e.target.closest('[data-canvas-bg]')) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }, [pan])

  const handleCanvasMouseMove = useCallback((e) => {
    if (dragHub) {
      // Dragging a hub
      setHubPositions((prev) => ({
        ...prev,
        [dragHub]: {
          x: (e.clientX - pan.x) / zoom,
          y: (e.clientY - (canvasRef.current?.getBoundingClientRect().top || 0) - pan.y) / zoom,
        },
      }))
    } else if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
    }
  }, [dragHub, isPanning, panStart, pan, zoom])

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false)
    setDragHub(null)
  }, [])

  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom((z) => Math.min(2, Math.max(0.3, z + delta)))
  }, [])

  const handleZoomIn = () => setZoom((z) => Math.min(2, z + 0.15))
  const handleZoomOut = () => setZoom((z) => Math.max(0.3, z - 0.15))
  const handleResetView = () => { setPan({ x: 0, y: 0 }); setZoom(1) }

  return (
    <div className="min-h-screen bg-[#060B18]">
      <Sidebar />
      <div
        className="h-screen flex flex-col transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? 224 : 72 }}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-4 flex-shrink-0">
          <div className="flex gap-1 p-1 rounded-xl bg-[#0B1628] border border-[#1A2744]">
            {['network', 'list'].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  view === v
                    ? 'bg-cogni-accent text-white shadow-lg shadow-cogni-accent/20'
                    : 'text-[#5B7BA3] hover:text-white'
                }`}
              >
                {v === 'network' ? 'Network View' : 'List View'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center bg-[#0B1628] border border-[#1A2744] rounded-xl px-4 py-2.5 gap-2 w-64">
              <Search size={14} className="text-[#3D5A80]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search hubs..."
                className="bg-transparent text-sm text-white placeholder-[#3D5A80] outline-none flex-1"
              />
            </div>
            <button className="relative w-10 h-10 rounded-full bg-[#0B1628] border border-[#1A2744] flex items-center justify-center text-[#3D5A80] hover:text-white transition-colors">
              <Bell size={16} />
              <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cogni-accent" />
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 relative overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }} className="w-8 h-8 border-2 border-[#1A2744] border-t-cogni-accent rounded-full" />
            </div>
          ) : view === 'network' ? (
            <div
              ref={canvasRef}
              className="w-full h-full relative select-none"
              style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
              onWheel={handleWheel}
              data-canvas-bg="true"
            >
              {/* Ambient bg effects */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-cogni-accent/[0.03] rounded-full blur-[150px]" />
                <div className="absolute bottom-1/3 right-1/3 w-[400px] h-[400px] bg-[#0E4D92]/[0.04] rounded-full blur-[120px]" />
              </div>

              {/* Pannable + zoomable layer */}
              <div
                className="absolute inset-0"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: '0 0',
                }}
              >
                {/* Connection lines between hubs */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
                  {filteredHubs.length > 1 && filteredHubs.slice(1).map((hub) => {
                    const corePos = hubPositions[filteredHubs[0].domain]
                    const hubPos = hubPositions[hub.domain]
                    if (!corePos || !hubPos) return null
                    return (
                      <line
                        key={`line-${hub.domain}`}
                        x1={corePos.x} y1={corePos.y}
                        x2={hubPos.x} y2={hubPos.y}
                        stroke="rgba(30,58,95,0.25)"
                        strokeWidth="1"
                        strokeDasharray="6 4"
                      />
                    )
                  })}
                </svg>

                {filteredHubs.map((hub, i) => {
                  const isCore = i === 0
                  const baseSize = isCore ? 240 : 110 + hub.mastery * 0.7
                  const Icon = HUB_ICONS[hub.domain] || HUB_ICONS.default
                  const label = formatLabel(hub.domain)
                  const pos = hubPositions[hub.domain] || { x: 300, y: 300 }

                  const ringCircumference = Math.PI * (baseSize - 4)
                  const ringDash = (hub.mastery / 100) * ringCircumference

                  return (
                    <motion.div
                      key={hub.domain}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.15, type: 'spring', stiffness: 180, damping: 18 }}
                      className="absolute group"
                      style={{
                        left: pos.x,
                        top: pos.y,
                        transform: 'translate(-50%, -50%)',
                        cursor: dragHub === hub.domain ? 'grabbing' : 'grab',
                        zIndex: dragHub === hub.domain ? 50 : isCore ? 10 : 5,
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        setDragHub(hub.domain)
                      }}
                      onClick={(e) => {
                        if (!dragHub) navigate(`/hubs/${encodeURIComponent(hub.domain)}`)
                      }}
                    >
                      {isCore && (
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-cogni-accent text-white text-[9px] font-bold uppercase tracking-wider whitespace-nowrap shadow-lg shadow-cogni-accent/30">
                          Core Hub
                        </div>
                      )}

                      {/* Outer ring container */}
                      <div
                        className="rounded-full relative flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
                        style={{ width: baseSize, height: baseSize }}
                      >
                        {/* Outer glow ring */}
                        <svg
                          className="absolute inset-0 -rotate-90"
                          viewBox={`0 0 ${baseSize} ${baseSize}`}
                          style={{ width: baseSize, height: baseSize }}
                        >
                          <circle
                            cx={baseSize / 2} cy={baseSize / 2} r={baseSize / 2 - 2}
                            fill="none" stroke={isCore ? 'rgba(139,92,246,0.12)' : 'rgba(30,58,95,0.4)'}
                            strokeWidth="1.5"
                          />
                          <circle
                            cx={baseSize / 2} cy={baseSize / 2} r={baseSize / 2 - 2}
                            fill="none"
                            stroke={isCore ? '#8B5CF6' : '#0E7490'}
                            strokeWidth="2" strokeLinecap="round"
                            strokeDasharray={`${ringDash} ${ringCircumference}`}
                            opacity={0.7}
                          />
                        </svg>

                        {/* Middle ring */}
                        <div
                          className="absolute rounded-full"
                          style={{
                            width: baseSize * 0.82,
                            height: baseSize * 0.82,
                            border: `1px solid ${isCore ? 'rgba(139,92,246,0.15)' : 'rgba(30,58,95,0.3)'}`,
                          }}
                        />

                        {/* Inner circle */}
                        <div
                          className="rounded-full flex flex-col items-center justify-center z-10 relative"
                          style={{
                            width: baseSize * 0.62,
                            height: baseSize * 0.62,
                            background: isCore
                              ? 'radial-gradient(ellipse at center, rgba(139,92,246,0.12) 0%, rgba(6,11,24,0.95) 70%)'
                              : 'radial-gradient(ellipse at center, rgba(14,116,144,0.08) 0%, rgba(6,11,24,0.95) 70%)',
                            border: `1px solid ${isCore ? 'rgba(139,92,246,0.25)' : 'rgba(30,58,95,0.4)'}`,
                            boxShadow: isCore ? '0 0 40px rgba(139,92,246,0.1)' : 'none',
                          }}
                        >
                          <Icon size={isCore ? 26 : 16} className={isCore ? 'text-cogni-accent mb-2' : 'text-[#0E7490] mb-1'} />
                          <p className={`font-display font-bold text-center leading-tight ${isCore ? 'text-sm' : 'text-[11px]'} text-white`}>
                            {label}
                            {isCore ? ' Hub' : ''}
                          </p>
                          <p className={`font-bold mt-1 ${isCore ? 'text-cogni-teal text-sm' : 'text-cogni-accent text-[10px]'}`}>
                            {hub.mastery}%{isCore ? ' Mastery' : ''}
                          </p>
                          <p className="text-[9px] text-[#3D5A80] mt-0.5">{hub.nodes.length} concepts</p>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* Zoom controls */}
              <div className="absolute right-6 bottom-24 flex flex-col gap-2 z-20">
                <button onClick={handleZoomIn} className="w-10 h-10 rounded-xl bg-[#0B1628]/80 border border-[#1A2744] flex items-center justify-center text-[#3D5A80] hover:text-white transition-colors">
                  <Plus size={16} />
                </button>
                <button onClick={handleZoomOut} className="w-10 h-10 rounded-xl bg-[#0B1628]/80 border border-[#1A2744] flex items-center justify-center text-[#3D5A80] hover:text-white transition-colors">
                  <Minus size={16} />
                </button>
                <button onClick={handleResetView} className="w-10 h-10 rounded-xl bg-[#0B1628]/80 border border-[#1A2744] flex items-center justify-center text-[#3D5A80] hover:text-white transition-colors">
                  <Navigation size={16} />
                </button>
              </div>

              {/* Zoom indicator */}
              <div className="absolute left-6 bottom-6 z-20 px-3 py-1.5 rounded-lg bg-[#0B1628]/80 border border-[#1A2744] text-[10px] text-[#3D5A80]">
                {Math.round(zoom * 100)}%
              </div>
            </div>
          ) : (
            <div className="p-8 max-w-4xl mx-auto space-y-3">
              {filteredHubs.map((hub, i) => {
                const Icon = HUB_ICONS[hub.domain] || HUB_ICONS.default
                return (
                  <motion.div
                    key={hub.domain}
                    initial={{ y: 15, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: i * 0.06 }}
                    onClick={() => navigate(`/hubs/${encodeURIComponent(hub.domain)}`)}
                    className="p-5 rounded-2xl bg-[#0B1628] border border-[#1A2744] hover:border-cogni-accent/30 cursor-pointer flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-cogni-accent/10 flex items-center justify-center">
                        <Icon size={22} className="text-cogni-accent" />
                      </div>
                      <div>
                        <p className="font-display font-bold">{formatLabel(hub.domain)} Hub</p>
                        <p className="text-xs text-[#3D5A80]">{hub.nodes.length} concepts</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="w-32 h-1.5 rounded-full bg-[#1A2744] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cogni-accent to-cogni-teal"
                          style={{ width: `${hub.mastery}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold text-cogni-teal w-12 text-right">{hub.mastery}%</span>
                      <ChevronRight size={16} className="text-[#3D5A80]" />
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-8 py-4 border-t border-[#1A2744] flex-shrink-0 bg-[#060B18]/80 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#0B1628] border border-[#1A2744]">
            <span className="text-xs text-[#3D5A80]">Total Mastery</span>
            <span className="text-sm font-bold text-cogni-teal">{totalMastery}%</span>
            <div className="w-16 h-1 rounded-full bg-[#1A2744] overflow-hidden">
              <div className="h-full rounded-full bg-cogni-teal" style={{ width: `${totalMastery}%` }} />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#0B1628] border border-[#1A2744]">
              <Brain size={16} className="text-cogni-accent" />
              <div>
                <p className="text-xs font-semibold text-white">{hubs.length} Knowledge Hubs</p>
                <p className="text-[10px] text-[#3D5A80]">Powered by Gemini</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
