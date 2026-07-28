import { useState, useEffect } from 'react'
import {
  BookOpen, Sparkles, ExternalLink, FileText, File,
  Facebook, Instagram, Linkedin, PlusCircle, AlertCircle, Loader2, FolderOpen,
} from 'lucide-react'
import { getBlogDriveLibrary, getDriveFileText, repurposeBlog, createPost } from '../api/client'
import toast from 'react-hot-toast'

const PLATFORM_ICONS = {
  facebook:  <Facebook  size={14} className="text-blue-600" />,
  instagram: <Instagram size={14} className="text-pink-500" />,
  linkedin:  <Linkedin  size={14} className="text-blue-700" />,
}

const SEGMENTS = [
  'Empty Nesters', 'Growing Families', 'Job Relocators',
  'Life Transitions', 'Long-Term Owners', 'Accidental Landlords',
]

function fileIcon(mimeType = '') {
  if (mimeType.includes('pdf')) return <File size={16} className="text-red-500" />
  if (mimeType.includes('document') || mimeType.includes('word'))
    return <FileText size={16} className="text-blue-500" />
  return <FileText size={16} className="text-gray-400" />
}

function fileTypeLabel(mimeType = '') {
  if (mimeType.includes('pdf')) return 'PDF'
  if (mimeType.includes('google-apps.document')) return 'Google Doc'
  if (mimeType.includes('word')) return 'Word'
  return 'File'
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function BlogRepurposer() {
  const [data, setData]               = useState(null)   // { categories, uncategorized }
  const [loadingLib, setLoadingLib]   = useState(true)
  const [authError, setAuthError]     = useState(false)
  const [activeCat, setActiveCat]     = useState(null)   // category id or 'uncategorized'

  // Repurpose panel state
  const [selected, setSelected]       = useState(null)   // article object
  const [articleText, setArticleText] = useState('')
  const [loadingText, setLoadingText] = useState(false)
  const [platforms, setPlatforms]     = useState(['facebook', 'instagram', 'linkedin'])
  const [segment, setSegment]         = useState('')
  const [repurposing, setRepurposing] = useState(false)
  const [results, setResults]         = useState(null)

  useEffect(() => { fetchLibrary() }, [])

  const fetchLibrary = async () => {
    setLoadingLib(true)
    setAuthError(false)
    try {
      const res = await getBlogDriveLibrary()
      const d = res.data
      setData(d)
      // Select first non-empty category by default
      const firstCat = d.categories.find(c => c.articles.length > 0)
      if (firstCat) setActiveCat(firstCat.id)
      else if (d.uncategorized?.length) setActiveCat('uncategorized')
    } catch (e) {
      if (e.response?.status === 401) setAuthError(true)
      else toast.error('Failed to load blog library')
    } finally {
      setLoadingLib(false)
    }
  }

  const selectArticle = async (article) => {
    setSelected(article)
    setResults(null)
    setArticleText('')
    setLoadingText(true)
    try {
      const res = await getDriveFileText(article.id, article.mimeType)
      setArticleText(res.data.text || '')
    } catch {
      setArticleText('')
    } finally {
      setLoadingText(false)
    }
  }

  const repurpose = async () => {
    if (!selected) return
    if (!platforms.length) { toast.error('Select at least one platform'); return }
    setRepurposing(true)
    setResults(null)
    try {
      const res = await repurposeBlog({
        blog_title: selected.name,
        blog_content: articleText || `Article: ${selected.name}`,
        platforms,
        target_segment: segment || null,
      })
      setResults(res.data.data)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Repurpose failed')
    } finally {
      setRepurposing(false)
    }
  }

  const saveToQueue = async (platform, post) => {
    try {
      await createPost({
        caption: post.caption,
        hashtags: post.hashtags,
        platform,
        content_type: 'text',
        title: selected?.name,
      })
      toast.success(`Saved to ${platform} queue`)
    } catch { toast.error('Failed to save') }
  }

  const togglePlatform = (p) =>
    setPlatforms(ps => ps.includes(p) ? ps.filter(x => x !== p) : [...ps, p])

  // Derive current articles list
  const activeArticles = (() => {
    if (!data) return []
    if (activeCat === 'uncategorized') return data.uncategorized || []
    return data.categories.find(c => c.id === activeCat)?.articles || []
  })()

  const tabs = [
    ...(data?.categories || []),
    ...(data?.uncategorized?.length ? [{ id: 'uncategorized', name: 'Uncategorized' }] : []),
  ]

  // ── Auth error ──
  if (!loadingLib && authError) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Blog Library</h1>
        <p className="text-gray-500 text-sm mb-6">Browse and repurpose blog articles from Google Drive.</p>
        <div className="card flex flex-col items-center text-center py-12 gap-4">
          <AlertCircle size={36} className="text-amber-400" />
          <div>
            <p className="font-semibold text-gray-800">Google Drive authorization required</p>
            <p className="text-sm text-gray-500 mt-1">Connect your Drive account to browse your blog articles.</p>
          </div>
          <a
            href="/api/drive/auth"
            className="btn-primary text-sm px-6"
          >
            Authorize Google Drive
          </a>
        </div>
      </div>
    )
  }

  // ── Loading ──
  if (loadingLib) {
    return (
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Blog Library</h1>
        <p className="text-gray-500 text-sm mb-6">Browse and repurpose blog articles from Google Drive.</p>
        <div className="card flex flex-col items-center py-16 gap-3 text-gray-400">
          <Loader2 size={28} className="animate-spin" />
          <span className="text-sm">Loading from Google Drive…</span>
        </div>
      </div>
    )
  }

  // ── Empty ──
  if (!data?.categories?.length && !data?.uncategorized?.length) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Blog Library</h1>
        <p className="text-gray-500 text-sm mb-6">Browse and repurpose blog articles from Google Drive.</p>
        <div className="card flex flex-col items-center py-16 gap-3 text-center">
          <FolderOpen size={36} className="text-gray-300" />
          <p className="text-gray-500 text-sm">
            No articles found. Make sure your Drive has a folder called{' '}
            <strong>Blog</strong> inside your Social Media folder, with
            category subfolders containing article files.
          </p>
          <button onClick={fetchLibrary} className="btn-secondary text-sm mt-2">Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blog Library</h1>
          <p className="text-gray-500 text-sm mt-1">
            Browse articles by category · click an article to repurpose it into social posts
          </p>
        </div>
        <button onClick={fetchLibrary} className="btn-secondary text-sm">Refresh</button>
      </div>

      <div className="flex gap-6">
        {/* ── LEFT: category + article list ── */}
        <div className="w-72 shrink-0 space-y-2">
          {/* Category tabs */}
          <div className="space-y-1">
            {tabs.map(cat => (
              <button
                key={cat.id}
                onClick={() => { setActiveCat(cat.id); setSelected(null); setResults(null) }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between group ${
                  activeCat === cat.id
                    ? 'bg-brand-50 text-brand-700 border border-brand-200'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className="truncate">{cat.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-normal ${
                  activeCat === cat.id ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-400'
                }`}>
                  {cat.id === 'uncategorized'
                    ? data.uncategorized?.length
                    : data.categories.find(c => c.id === cat.id)?.articles?.length ?? 0}
                </span>
              </button>
            ))}
          </div>

          {/* Article list for active category */}
          <div className="mt-3 space-y-1">
            {activeArticles.map(article => (
              <button
                key={article.id}
                onClick={() => selectArticle(article)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors border ${
                  selected?.id === article.id
                    ? 'bg-white border-brand-300 shadow-sm'
                    : 'border-transparent hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">{fileIcon(article.mimeType)}</span>
                  <div className="min-w-0">
                    <p className="text-gray-800 font-medium line-clamp-2 leading-snug">{article.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(article.modifiedTime)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── RIGHT: repurpose panel ── */}
        <div className="flex-1 min-w-0">
          {!selected ? (
            <div className="card flex flex-col items-center justify-center py-20 text-center">
              <BookOpen size={36} className="text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">Select an article to repurpose it into social posts</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Article header */}
              <div className="card space-y-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0">{fileIcon(selected.mimeType)}</span>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-gray-900 text-lg leading-snug">{selected.name}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-400">{fileTypeLabel(selected.mimeType)}</span>
                      {selected.modifiedTime && (
                        <span className="text-xs text-gray-400">Modified {formatDate(selected.modifiedTime)}</span>
                      )}
                      {selected.webViewLink && (
                        <a
                          href={selected.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
                        >
                          Open in Drive <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {loadingText && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Loader2 size={14} className="animate-spin" /> Loading article content…
                  </div>
                )}
                {!loadingText && articleText && (
                  <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                    <p className="text-xs text-gray-600 whitespace-pre-line line-clamp-6">{articleText.slice(0, 600)}{articleText.length > 600 ? '…' : ''}</p>
                  </div>
                )}

                {/* Platforms */}
                <div>
                  <label className="label">Repurpose to Platforms</label>
                  <div className="flex gap-3">
                    {['facebook', 'instagram', 'linkedin'].map(p => (
                      <button key={p} onClick={() => togglePlatform(p)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          platforms.includes(p)
                            ? 'bg-brand-50 border-brand-400 text-brand-700'
                            : 'bg-white border-gray-200 text-gray-500'
                        }`}
                      >
                        {PLATFORM_ICONS[p]} {p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Segment */}
                <div>
                  <label className="label">Target Segment (optional)</label>
                  <select className="input" value={segment} onChange={e => setSegment(e.target.value)}>
                    <option value="">All Audiences</option>
                    {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <button
                  onClick={repurpose}
                  disabled={repurposing || loadingText}
                  className="btn-primary flex items-center gap-2 w-full justify-center py-3"
                >
                  <Sparkles size={18} />
                  {repurposing ? 'Repurposing…' : 'Repurpose into Social Posts'}
                </button>
              </div>

              {/* Results */}
              {results && Object.entries(results).map(([platform, post]) => (
                <div key={platform} className="card space-y-4">
                  <div className="flex items-center gap-2">
                    {PLATFORM_ICONS[platform]}
                    <span className="font-semibold capitalize">{platform}</span>
                    {post.key_insight && (
                      <span className="text-xs text-gray-400 ml-auto italic line-clamp-1">"{post.key_insight}"</span>
                    )}
                  </div>
                  <div>
                    <label className="label">Caption</label>
                    <textarea className="input resize-none" rows={4} defaultValue={post.caption} />
                  </div>
                  <div>
                    <label className="label">Hashtags</label>
                    <input className="input" defaultValue={post.hashtags} />
                  </div>
                  <button onClick={() => saveToQueue(platform, post)} className="btn-primary text-sm flex items-center gap-2">
                    <PlusCircle size={15} /> Save to {platform} Queue
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
