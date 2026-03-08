import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import { api } from '../api/client'
import { useTracker } from '../hooks/useTracker'
import {
  ArrowLeft, Bell, Search, Sparkles, Play,
  Volume2, Maximize, Settings, Send, BookOpen,
  ExternalLink, Brain, Globe,
} from 'lucide-react'

export function VideoViewPage() {
  const { nodeId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useStore()
  const { logEvent } = useTracker(nodeId)

  // Data from navigation state or fetched fresh
  const [snippet, setSnippet] = useState(location.state?.snippet || null)
  const [node, setNode] = useState(location.state?.node || null)
  const [recommendation, setRecommendation] = useState(location.state?.recommendation || null)
  const [loading, setLoading] = useState(!snippet && !node)
  const [activeTab, setActiveTab] = useState('insights')
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState([])
  const [chatLoading, setChatLoading] = useState(false)
  const [webResources, setWebResources] = useState([])

  // Fetch data if not passed via navigation state
  useEffect(() => {
    if (node && snippet) {
      setLoading(false)
      return
    }
    if (!nodeId || !user) return

    const fetchData = async () => {
      try {
        // Get node info from canvas
        const graphRes = await api.get('/graph/canvas')
        const foundNode = (graphRes.data.nodes || []).find((n) => String(n.id) === nodeId)
        if (foundNode) {
          setNode(foundNode)

          // Get recommendation for this node
          const recRes = await api.post('/gemini/recommend', { node_ids: [foundNode.id] })
          if (recRes.data.recommendation) {
            setRecommendation(recRes.data.recommendation)
          }

          // Fetch YouTube snippet with proper schema
          const snippetRes = await api.post('/youtube/snippet', {
            concept: foundNode.concept,
            gap_description: recRes.data.recommendation?.gemini_reasoning || `Understanding ${foundNode.concept}`,
            youtube_query: `${foundNode.concept} tutorial explained`,
            timestamp_hint: 'core explanation and examples',
            recommendation_id: recRes.data.recommendation?.id || undefined,
          })
          if (snippetRes.data.snippet) {
            setSnippet(snippetRes.data.snippet)
          }
        }
      } catch (err) {
        console.error('Failed to load video data:', err)
      }
      setLoading(false)
    }

    fetchData()
  }, [nodeId, user])

  // Log view event
  useEffect(() => {
    if (node && nodeId) {
      logEvent('view', { duration_seconds: 0 })
    }
  }, [node])

  // Generate web resource links based on concept
  useEffect(() => {
    if (!node) return
    const concept = node.concept
    const encoded = encodeURIComponent(concept)
    setWebResources([
      { title: `${concept} - Wikipedia`, url: `https://en.wikipedia.org/wiki/${encoded.replace(/%20/g, '_')}`, icon: Globe },
      { title: `${concept} Tutorial - MDN / Docs`, url: `https://www.google.com/search?q=${encoded}+documentation+tutorial`, icon: BookOpen },
      { title: `${concept} - Research Papers`, url: `https://scholar.google.com/scholar?q=${encoded}`, icon: BookOpen },
    ])
  }, [node])

  // Chat with Gemini via recommend endpoint
  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return
    const msg = chatInput.trim()
    setChatInput('')
    setChatMessages((prev) => [...prev, { role: 'user', content: msg }])
    setChatLoading(true)

    try {
      const res = await api.post('/gemini/recommend', {
        node_ids: node ? [node.id] : [],
      })
      const rec = res.data.recommendation
      setChatMessages((prev) => [
        ...prev,
        { role: 'gemini', content: rec?.gemini_reasoning || rec?.practice_scenario || 'Let me analyze that for you...' },
      ])
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'gemini', content: 'I can help with questions about this video. Try asking about specific concepts.' },
      ])
    }
    setChatLoading(false)
  }

  const formatTime = (s) => {
    if (!s && s !== 0) return '0:00'
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  const startSec = snippet?.start_seconds || 0
  const endSec = snippet?.end_seconds || startSec + 60
  const totalSec = endSec > 0 ? endSec : 765
  const progressPct = totalSec > 0 ? Math.round((startSec / totalSec) * 100) : 0

  return (
    <div className="min-h-screen bg-cogni-bg flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-cogni-bg/80 backdrop-blur-xl flex-shrink-0 z-20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/canvas')}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cogni-accent to-cogni-teal flex items-center justify-center">
              <Brain size={16} className="text-white" />
            </div>
            <span className="font-display font-bold text-lg">CogniPath</span>
          </div>
          <div className="flex items-center gap-6 ml-4">
            {['Courses', 'My Library', 'Certifications'].map((tab) => (
              <button key={tab} className="text-sm text-white/40 hover:text-white transition-colors">{tab}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-cogni-card border border-cogni-border rounded-xl px-3 py-1.5 gap-2 w-52">
            <Search size={12} className="text-white/30" />
            <input placeholder="Search courses..." className="bg-transparent text-xs text-white placeholder-white/30 outline-none flex-1" />
          </div>
          <button className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white"><Bell size={14} /></button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cogni-accent to-cogni-teal flex items-center justify-center text-xs font-bold">{user?.name?.[0] || 'U'}</div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Video */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center gap-2 text-xs text-white/40 mb-4">
            <button onClick={() => navigate('/canvas')} className="hover:text-white transition-colors flex items-center gap-1">
              <ArrowLeft size={12} /> Back
            </button>
            <span>&gt;</span>
            <span>{node?.domain?.replace(/_/g, ' ') || 'Learning Path'}</span>
            <span>&gt;</span>
            <span className="text-white/60 font-medium">{snippet?.title || node?.concept || 'Video'}</span>
          </div>

          {/* Video player */}
          <div className="rounded-2xl overflow-hidden border border-cogni-border bg-black relative mb-6">
            {loading ? (
              <div className="aspect-video flex items-center justify-center bg-cogni-card">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }} className="w-8 h-8 border-2 border-white/20 border-t-cogni-accent rounded-full" />
              </div>
            ) : snippet?.video_id ? (
              <div className="aspect-video">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${snippet.video_id}?start=${startSec}`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={snippet.title || 'Video snippet'}
                />
              </div>
            ) : (
              <div className="aspect-video flex flex-col items-center justify-center bg-cogni-card">
                <Play size={48} className="text-white/20 mb-3" />
                <p className="text-white/40 text-sm">No video snippet available</p>
                <p className="text-white/20 text-xs mt-1">Try another concept or check back later</p>
              </div>
            )}

            {snippet?.video_id && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8">
                <div className="h-1 rounded-full bg-white/20 overflow-hidden mb-2">
                  <div className="h-full rounded-full bg-cogni-accent" style={{ width: `${progressPct}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-white/60">
                  <div className="flex items-center gap-3">
                    <span>{formatTime(startSec)} / {formatTime(totalSec)}</span>
                    <Volume2 size={14} />
                  </div>
                  <div className="flex items-center gap-3">
                    <Settings size={14} />
                    <Maximize size={14} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Snippet Summary + Resources */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <BookOpen size={16} className="text-cogni-teal" />
                <h3 className="font-display font-bold text-cogni-teal">Snippet Summary</h3>
              </div>
              <div className="cogni-card">
                <p className="text-sm text-white/60 leading-relaxed">
                  {recommendation?.practice_scenario ||
                   recommendation?.gemini_reasoning ||
                   `This module covers the foundational principles of ${node?.concept || 'this concept'}.`}
                </p>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={16} className="text-cogni-warning" />
                <h3 className="font-display font-bold text-cogni-warning">Key Resources</h3>
              </div>
              <div className="space-y-2">
                {webResources.map((res, i) => (
                  <a
                    key={i}
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full cogni-card-hover flex items-center justify-between text-left block"
                  >
                    <div className="flex items-center gap-3">
                      <res.icon size={16} className="text-white/40" />
                      <span className="text-sm">{res.title}</span>
                    </div>
                    <ExternalLink size={14} className="text-white/20" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Gemini Sidebar */}
        <div className="w-80 border-l border-white/5 flex flex-col bg-cogni-card/30 flex-shrink-0">
          <div className="px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <Sparkles size={18} className="text-cogni-accent" />
              <div>
                <h3 className="font-display font-bold text-sm">Gemini Sidebar</h3>
                <p className="text-[10px] font-bold uppercase tracking-wider text-cogni-teal">Live AI Analysis</p>
              </div>
            </div>
          </div>

          <div className="flex gap-1 px-5 py-3">
            {[
              { key: 'insights', label: 'Insights', icon: Sparkles },
              { key: 'notes', label: 'Notes', icon: BookOpen },
              { key: 'qa', label: 'Q&A', icon: Send },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === key ? 'bg-cogni-accent text-white' : 'text-white/40 hover:text-white'
                }`}
              >
                <Icon size={11} />
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-2 space-y-4">
            {activeTab === 'insights' && (
              <>
                {snippet?.start_seconds != null && (
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-md bg-cogni-danger/20 text-cogni-danger text-[10px] font-bold">
                        {formatTime(snippet.start_seconds)}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-cogni-danger">Critical Concept</span>
                    </div>
                    <p className="text-xs text-white/60 leading-relaxed">
                      {snippet.snippet_reason || `Pay attention to the key explanation at ${formatTime(snippet.start_seconds)}.`}
                    </p>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">Key Vocabulary</p>
                  <div className="flex flex-wrap gap-2">
                    {(node?.concept ? [node.concept, ...(node.domain ? [node.domain.replace(/_/g, ' ')] : [])] : ['Concept']).map((term, i) => (
                      <span key={i} className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60">{term}</span>
                    ))}
                  </div>
                </div>

                {recommendation?.gemini_reasoning && (
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">Contextual Note</p>
                    <p className="text-xs text-white/60 leading-relaxed">{recommendation.gemini_reasoning}</p>
                  </div>
                )}
              </>
            )}

            {activeTab === 'notes' && (
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                <p className="text-xs text-white/40">Your notes for this video will appear here.</p>
              </div>
            )}

            {activeTab === 'qa' && (
              <div className="space-y-2">
                {chatMessages.map((msg, i) => (
                  <motion.div key={i} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                    className={`text-xs p-3 rounded-xl ${msg.role === 'user' ? 'bg-cogni-accent/15 border border-cogni-accent/20 ml-4' : 'bg-white/[0.03] border border-white/10 mr-4'}`}>
                    <p className="text-white/70 leading-relaxed">{msg.content}</p>
                  </motion.div>
                ))}
                {chatLoading && (
                  <div className="flex gap-1 p-3">
                    {[0, 1, 2].map((i) => (
                      <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} className="w-1.5 h-1.5 rounded-full bg-white/30" />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-white/5 flex-shrink-0">
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                placeholder="Ask Gemini about this video..."
                className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/25 outline-none focus:border-cogni-accent/30"
              />
              <button onClick={handleChatSend} disabled={!chatInput.trim() || chatLoading}
                className="w-8 h-8 rounded-full bg-cogni-accent flex items-center justify-center text-white disabled:opacity-30">
                <Send size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
