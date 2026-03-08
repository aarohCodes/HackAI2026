import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import { Sidebar } from '../components/ui/Sidebar'
import { api } from '../api/client'
import { ArrowLeft, Play, Globe, BookOpen, GitBranch, CheckCircle, ExternalLink } from 'lucide-react'

const STATE_BADGE = {
  green: { label: 'Completed', bg: 'bg-cogni-success/20', text: 'text-cogni-success' },
  yellow: { label: 'In Progress', bg: 'bg-cogni-warning/20', text: 'text-cogni-warning' },
  red: { label: 'Not Started', bg: 'bg-cogni-danger/20', text: 'text-cogni-danger' },
}

function Spinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity }}
      className="w-5 h-5 border-2 border-white/20 border-t-cogni-accent rounded-full"
    />
  )
}

function SectionShell({ icon: Icon, title, loading, error, fallback, children }) {
  return (
    <div className="rounded-2xl bg-[#0B1628] border border-[#1A2744] p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-cogni-accent/10 flex items-center justify-center">
          <Icon size={18} className="text-cogni-accent" />
        </div>
        <h2 className="font-display font-bold text-lg text-white">{title}</h2>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : error ? (
        <div>
          <p className="text-sm text-amber-400/90 mb-2">{error}</p>
          {fallback}
        </div>
      ) : (
        children
      )}
    </div>
  )
}

function formatLabel(str) {
  return (str || '').replace(/_/g, ' ').split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export function ResourcePage() {
  const { nodeId } = useParams()
  const navigate = useNavigate()
  const { user, sidebarOpen, fetchGraph, invalidateGraph } = useStore()

  const [node, setNode] = useState(null)
  const [nodeLoading, setNodeLoading] = useState(true)

  const [video, setVideo] = useState(null)
  const [videoLoading, setVideoLoading] = useState(true)
  const [videoError, setVideoError] = useState(null)

  const [webResults, setWebResults] = useState([])
  const [webLoading, setWebLoading] = useState(true)
  const [webError, setWebError] = useState(null)

  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState(null)

  const [flowchart, setFlowchart] = useState(null)
  const [flowchartLoading, setFlowchartLoading] = useState(true)
  const [flowchartError, setFlowchartError] = useState(null)

  const [completing, setCompleting] = useState(false)
  const [completed, setCompleted] = useState(false)

  // Fetch node data
  useEffect(() => {
    if (!user) return
    fetchGraph().then(({ nodes }) => {
      const found = nodes.find((n) => (n.id || n._id) === nodeId)
      setNode(found || null)
      setNodeLoading(false)
    }).catch(() => setNodeLoading(false))
  }, [user, nodeId])

  // Fetch all resources once we have the node
  useEffect(() => {
    if (!node) return
    const concept = node.concept
    const query = concept + ' tutorial'

    setVideoError(null)
    setWebError(null)
    setSummaryError(null)
    setFlowchartError(null)

    api.post('/search/youtube', { query })
      .then((res) => setVideo(res.data?.youtube_result || res.data || null))
      .catch((err) => {
        setVideo(null)
        setVideoError(err.response?.data?.detail || err.message || 'Video search failed.')
      })
      .finally(() => setVideoLoading(false))

    api.post('/search/search', { query })
      .then((res) => {
        const results = res.data?.results || res.data?.web_results || []
        setWebResults(results.slice(0, 2))
      })
      .catch((err) => {
        setWebResults([])
        setWebError(err.response?.data?.detail || err.message || 'Web search unavailable.')
      })
      .finally(() => setWebLoading(false))

    api.post('/summary', { topic: concept })
      .then((res) => setSummary(res.data))
      .catch((err) => {
        setSummary(null)
        setSummaryError(err.response?.data?.detail || err.message || 'Summary failed.')
      })
      .finally(() => setSummaryLoading(false))

    api.post('/flowchart', { query: concept })
      .then((res) => setFlowchart(res.data))
      .catch((err) => {
        setFlowchart(null)
        setFlowchartError(err.response?.data?.detail || err.message || 'Flowchart failed.')
      })
      .finally(() => setFlowchartLoading(false))
  }, [node])

  const handleComplete = async () => {
    if (completing) return
    setCompleting(true)
    try {
      await api.post('/graph/event', { node_id: nodeId, event_type: 'complete' })
      setCompleted(true)
      setNode((prev) => prev ? { ...prev, state: 'green' } : prev)
      invalidateGraph()
    } catch (err) {
      console.error('Failed to mark complete:', err)
    } finally {
      setCompleting(false)
    }
  }

  const badge = STATE_BADGE[node?.state] || STATE_BADGE.red

  return (
    <div className="min-h-screen bg-[#060B18]">
      <Sidebar />
      <div
        className="min-h-screen transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? 224 : 72 }}
      >
        <div className="max-w-4xl mx-auto px-8 py-8 space-y-6">
          {/* Header */}
          {nodeLoading ? (
            <div className="flex items-center justify-center h-32">
              <Spinner />
            </div>
          ) : !node ? (
            <div className="text-center py-20">
              <p className="text-[#5B7BA3] text-lg">Concept not found.</p>
              <button onClick={() => navigate('/hubs')} className="mt-4 text-cogni-accent hover:underline text-sm">
                Back to Hubs
              </button>
            </div>
          ) : (
            <>
              {/* Section 1: Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => navigate(`/hubs/${encodeURIComponent(node.domain)}`)}
                    className="w-10 h-10 rounded-xl bg-[#0B1628] border border-[#1A2744] flex items-center justify-center text-[#5B7BA3] hover:text-white hover:border-cogni-accent/30 transition-all"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#5B7BA3] mb-1">
                      <span className="hover:text-cogni-accent cursor-pointer" onClick={() => navigate(`/hubs/${encodeURIComponent(node.domain)}`)}>
                        {formatLabel(node.domain)}
                      </span>
                      <span>/</span>
                      <span className="text-white">{formatLabel(node.concept)}</span>
                    </div>
                    <h1 className="text-2xl font-display font-bold text-white">{formatLabel(node.concept)}</h1>
                  </div>
                </div>
                <span className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${badge.bg} ${badge.text}`}>
                  {badge.label}
                </span>
              </div>

              {/* Section 2: YouTube Video */}
              <SectionShell icon={Play} title="Video Tutorial" loading={videoLoading} error={videoError}>
                {video?.video_id ? (
                  <div>
                    <div className="aspect-video rounded-xl overflow-hidden bg-black">
                      <iframe
                        src={`https://www.youtube-nocookie.com/embed/${video.video_id}`}
                        title={video.title || 'Tutorial video'}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full"
                      />
                    </div>
                    {(video.title || video.channel) && (
                      <div className="mt-3">
                        {video.title && <p className="text-sm font-semibold text-white">{video.title}</p>}
                        {video.channel && <p className="text-xs text-[#5B7BA3] mt-0.5">{video.channel}</p>}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-[#5B7BA3]">No video available for this topic.</p>
                )}
              </SectionShell>

              {/* Section 3: Web Resources */}
              <SectionShell
                icon={Globe}
                title="Web Resources"
                loading={webLoading}
                error={webError}
                fallback={node && (
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(node.concept + ' tutorial')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-cogni-accent/40 text-sm text-cogni-accent"
                  >
                    <ExternalLink size={14} />
                    Search on Google instead
                  </a>
                )}
              >
                {webResults.length > 0 ? (
                  <div className="space-y-3">
                    {webResults.map((result, i) => (
                      <a
                        key={i}
                        href={result.url || result.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-4 rounded-xl bg-[#060B18] border border-[#1A2744] hover:border-cogni-accent/30 transition-all group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white group-hover:text-cogni-accent transition-colors truncate">
                              {result.title}
                            </p>
                            <p className="text-xs text-[#3D5A80] mt-1 truncate">{result.url || result.link}</p>
                          </div>
                          <ExternalLink size={14} className="text-[#3D5A80] group-hover:text-cogni-accent flex-shrink-0 mt-0.5" />
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-[#5B7BA3]">No web resources found.</p>
                    {node && (
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(node.concept + ' tutorial')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-cogni-accent/40 text-sm text-cogni-accent"
                      >
                        <ExternalLink size={14} />
                        Search on Google
                      </a>
                    )}
                  </div>
                )}
              </SectionShell>

              {/* Section 4: Summary */}
              <SectionShell icon={BookOpen} title="Summary" loading={summaryLoading} error={summaryError}>
                {summary ? (
                  <div>
                    {summary.summary && (
                      <p className="text-sm text-white/80 leading-relaxed mb-4">{summary.summary}</p>
                    )}
                    {summary.key_points?.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-cogni-teal mb-2">Key Points</p>
                        <ul className="space-y-2">
                          {summary.key_points.map((point, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                              <span className="w-1.5 h-1.5 rounded-full bg-cogni-accent mt-1.5 flex-shrink-0" />
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-[#5B7BA3]">Summary unavailable.</p>
                )}
              </SectionShell>

              {/* Section 5: Flowchart */}
              <SectionShell icon={GitBranch} title="Concept Flowchart" loading={flowchartLoading} error={flowchartError}>
                {flowchart ? (
                  <div>
                    {flowchart.mermaid_code && (
                      <div className="rounded-xl bg-[#060B18] border border-[#1A2744] p-4 overflow-x-auto">
                        <pre className="text-xs text-white/70 font-mono whitespace-pre-wrap">{flowchart.mermaid_code}</pre>
                      </div>
                    )}
                    {flowchart.explanation && (
                      <p className="text-sm text-white/70 mt-4 leading-relaxed">{flowchart.explanation}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-[#5B7BA3]">Flowchart unavailable.</p>
                )}
              </SectionShell>

              {/* Section 6: Mark Complete */}
              <div className="rounded-2xl bg-[#0B1628] border border-[#1A2744] p-6 flex items-center justify-between">
                <div>
                  <h2 className="font-display font-bold text-lg text-white">Ready to move on?</h2>
                  <p className="text-sm text-[#5B7BA3] mt-1">Mark this concept as complete to update your progress.</p>
                </div>
                {completed ? (
                  <div className="flex items-center gap-2 px-5 py-3 rounded-xl bg-cogni-success/20 text-cogni-success text-sm font-semibold">
                    <CheckCircle size={18} />
                    Completed!
                  </div>
                ) : (
                  <button
                    onClick={handleComplete}
                    disabled={completing}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-cogni-accent text-white text-sm font-semibold hover:bg-cogni-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cogni-accent/20"
                  >
                    <CheckCircle size={18} />
                    {completing ? 'Marking...' : 'Mark as Complete'}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
