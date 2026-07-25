import { useState, useEffect, useRef } from 'react'
import { getMedia, uploadMedia, deleteMedia } from '../api/client'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Upload, Trash2, Film, Copy, FolderOpen, ChevronRight, Home, Link, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

function formatBytes(b) {
  if (!b) return '—'
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

const FOLDER_ICONS = {
  Images:       '🖼️',
  Infographics: '📊',
  Reels:        '🎬',
  Videos:       '📹',
  Blog:         '📝',
}

// ─── Uploaded Media tab ───────────────────────────────────────────────────────
function UploadedMedia({ onSelectUrl }) {
  const [assets, setAssets]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [filter, setFilter]     = useState('all')
  const [altText, setAltText]   = useState('')
  const inputRef = useRef(null)

  useEffect(() => { fetchAssets() }, [])

  const fetchAssets = () => {
    setLoading(true)
    getMedia().then(r => setAssets(r.data.assets)).catch(console.error).finally(() => setLoading(false))
  }

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    let ok = 0
    for (const file of files) {
      try {
        const fd = new FormData()
        fd.append('file', file)
        if (altText) fd.append('alt_text', altText)
        await uploadMedia(fd)
        ok++
      } catch { toast.error(`Failed: ${file.name}`) }
    }
    if (ok) { toast.success(`${ok} file(s) uploaded`); fetchAssets() }
    setUploading(false)
    e.target.value = ''
  }

  const remove = async (id) => {
    if (!confirm('Delete this asset?')) return
    try {
      await deleteMedia(id)
      setAssets(a => a.filter(x => x.id !== id))
      toast.success('Deleted')
    } catch { toast.error('Failed to delete') }
  }

  const copyUrl = (url) => {
    const full = `${window.location.origin}${url}`
    navigator.clipboard.writeText(full)
    toast.success('URL copied')
  }

  const filtered = filter === 'all' ? assets : assets.filter(a => a.media_type === filter)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <label className="label text-xs">Alt text for next upload (optional)</label>
          <input className="input max-w-xs text-sm" placeholder="Describe the image…" value={altText} onChange={e => setAltText(e.target.value)} />
        </div>
        <button onClick={() => inputRef.current?.click()} disabled={uploading} className="btn-primary flex items-center gap-2">
          <Upload size={16} /> {uploading ? 'Uploading…' : 'Upload Files'}
        </button>
        <input ref={inputRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleUpload} />
      </div>

      <div className="flex gap-2">
        {['all','image','video'].map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter===t ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t==='all' ? `All (${assets.length})` : t==='image' ? `Images (${assets.filter(a=>a.media_type==='image').length})` : `Videos (${assets.filter(a=>a.media_type==='video').length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <Upload size={36} className="text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No uploaded files yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map(asset => (
            <div key={asset.id} className="group relative bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              {asset.media_type === 'image' ? (
                <img src={asset.url} alt={asset.alt_text || ''} className="w-full h-32 object-cover" />
              ) : (
                <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                  <Film size={32} className="text-gray-400" />
                </div>
              )}
              <div className="p-2">
                <p className="text-xs text-gray-700 font-medium truncate">{asset.original_filename}</p>
                <p className="text-xs text-gray-400">{formatBytes(asset.file_size)}</p>
              </div>
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => copyUrl(asset.url)} className="w-7 h-7 bg-white rounded-md shadow flex items-center justify-center text-gray-600 hover:text-brand-600" title="Copy URL">
                  <Copy size={13} />
                </button>
                {onSelectUrl && (
                  <button onClick={() => { onSelectUrl(`${window.location.origin}${asset.url}`); toast.success('URL selected') }}
                    className="w-7 h-7 bg-brand-600 rounded-md shadow flex items-center justify-center text-white hover:bg-brand-700" title="Use in post">
                    <CheckCircle size={13} />
                  </button>
                )}
                <button onClick={() => remove(asset.id)} className="w-7 h-7 bg-white rounded-md shadow flex items-center justify-center text-gray-600 hover:text-red-500" title="Delete">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Google Drive browser tab ─────────────────────────────────────────────────
// Browses the real Social Media Drive folder directly (drive.google.com/drive/folders/<id>) —
// the source of truth for items chosen for publishing.
export function GoogleDriveBrowser({ onSelectUrl }) {
  const [driveStatus, setDriveStatus] = useState(null)
  const [crumbs, setCrumbs]           = useState([{ id: null, name: 'Social Media' }]) // null id = root folder
  const [contents, setContents]       = useState(null)
  const [loading, setLoading]         = useState(false)
  const [sharingId, setSharingId]     = useState(null)   // file id being made public
  const [sharedUrls, setSharedUrls]   = useState({})      // file id → drive url

  useEffect(() => {
    axios.get('/api/drive/status').then(r => setDriveStatus(r.data)).catch(console.error)
    browseFolder(null, [{ id: null, name: 'Social Media' }])
  }, [])

  const browseFolder = (folderId, nextCrumbs) => {
    setLoading(true)
    axios.get('/api/drive/social-browse', { params: folderId ? { folder_id: folderId } : {} })
      .then(r => { setContents(r.data); setCrumbs(nextCrumbs) })
      .catch(e => toast.error(e.response?.data?.detail || 'Browse failed'))
      .finally(() => setLoading(false))
  }

  const openFolder = (folder) => {
    browseFolder(folder.id, [...crumbs, { id: folder.id, name: folder.name }])
  }

  const openCrumb = (index) => {
    const target = crumbs[index]
    browseFolder(target.id, crumbs.slice(0, index + 1))
  }

  const getShareUrl = async (file) => {
    if (sharedUrls[file.id]) {
      const url = sharedUrls[file.id]
      if (onSelectUrl) onSelectUrl(url)
      navigator.clipboard.writeText(url)
      toast.success('Drive URL copied & selected')
      return
    }

    setSharingId(file.id)
    try {
      const res = await axios.post('/api/drive/file-url', { file_id: file.id })
      const url = res.data.url
      setSharedUrls(s => ({ ...s, [file.id]: url }))
      if (onSelectUrl) onSelectUrl(url)
      navigator.clipboard.writeText(url)
      toast.success('Public URL copied & selected!')
    } catch (e) {
      const detail = e.response?.data?.detail || 'Failed to get public URL'
      if (detail.includes('not authenticated')) {
        toast.error('Authorize Google Drive first — see setup instructions below')
      } else {
        toast.error(detail)
      }
    } finally {
      setSharingId(null)
    }
  }

  const FILE_TYPE_COLORS = {
    image:    'bg-purple-50 border-purple-200',
    video:    'bg-blue-50  border-blue-200',
    document: 'bg-gray-50  border-gray-200',
  }

  return (
    <div className="space-y-5">
      {/* Drive status banner */}
      {driveStatus && (
        <div className={`rounded-lg border px-4 py-3 flex items-start gap-3 ${driveStatus.is_authenticated ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          {driveStatus.is_authenticated
            ? <CheckCircle size={18} className="text-green-600 mt-0.5 shrink-0" />
            : <AlertCircle size={18} className="text-amber-600 mt-0.5 shrink-0" />}
          <div className="flex-1 text-sm">
            {driveStatus.is_authenticated ? (
              <p className="text-green-800 font-medium">Google Drive connected — browsing your Social Media Drive folder directly.</p>
            ) : (
              <div className="text-amber-800 space-y-1">
                <p className="font-medium">Google Drive not yet authorized.</p>
                {!driveStatus.has_credentials ? (
                  <p>You need to download <code className="bg-amber-100 px-1 rounded">google_credentials.json</code> — see setup steps below.</p>
                ) : (
                  <p>Credentials found. <a href="http://localhost:8000/api/drive/auth" target="_blank" rel="noreferrer" className="underline font-semibold">Click here to authorize →</a> then refresh this page.</p>
                )}
              </div>
            )}
          </div>
          <button onClick={() => { axios.get('/api/drive/status').then(r => setDriveStatus(r.data)) }} className="text-gray-400 hover:text-gray-600">
            <RefreshCw size={15} />
          </button>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
        {crumbs.map((c, i) => (
          <span key={c.id || 'root'} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} />}
            <button onClick={() => openCrumb(i)} className="hover:text-brand-600 flex items-center gap-1">
              {i === 0 && <Home size={14} />} {c.name}
            </button>
          </span>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : !contents ? null : (
        <div className="space-y-4">
          {/* Subfolders */}
          {contents.folders.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {contents.folders.map(folder => (
                <button key={folder.id} onClick={() => openFolder(folder)}
                  className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-colors text-left group">
                  <span className="text-2xl">{FOLDER_ICONS[folder.name] || '📁'}</span>
                  <span className="text-sm font-medium text-gray-800 group-hover:text-brand-700">{folder.name}</span>
                  <ChevronRight size={14} className="ml-auto text-gray-400 group-hover:text-brand-500" />
                </button>
              ))}
            </div>
          )}

          {/* Files */}
          {contents.files.length === 0 && contents.folders.length === 0 && (
            <div className="card text-center py-12 text-gray-400">
              <FolderOpen size={36} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">This folder is empty. Add files directly to the Drive folder.</p>
            </div>
          )}

          {contents.files.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{contents.files.length} file{contents.files.length !== 1 ? 's' : ''}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {contents.files.map(file => {
                  const cached = sharedUrls[file.id]
                  const busy   = sharingId === file.id
                  return (
                    <div key={file.id} className={`rounded-xl border p-4 flex items-center gap-3 ${FILE_TYPE_COLORS[file.media_type] || 'bg-gray-50 border-gray-200'}`}>
                      <div className="text-2xl shrink-0">
                        {file.media_type === 'image' ? '🖼️' : file.media_type === 'video' ? '🎬' : '📄'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                        {cached && (
                          <p className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                            <CheckCircle size={11} /> Public on Drive
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => getShareUrl(file)}
                        disabled={busy}
                        title={cached ? 'Copy Drive URL & use in post' : 'Make public & get URL'}
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          cached
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-brand-600 hover:bg-brand-700 text-white'
                        } disabled:opacity-50`}
                      >
                        {busy ? (
                          <RefreshCw size={13} className="animate-spin" />
                        ) : (
                          <Link size={13} />
                        )}
                        {busy ? 'Sharing…' : cached ? 'Use URL' : 'Get URL'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Setup instructions (collapsed) */}
      {driveStatus && !driveStatus.has_credentials && (
        <details className="card border-amber-200 bg-amber-50">
          <summary className="font-semibold text-amber-900 cursor-pointer select-none">
            Google Drive Setup Instructions
          </summary>
          <ol className="mt-3 space-y-2 text-sm text-amber-800 list-decimal list-inside">
            <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="underline">console.cloud.google.com</a> and create a new project (or select existing)</li>
            <li>Search for <strong>"Google Drive API"</strong> and click <strong>Enable</strong></li>
            <li>Go to <strong>APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID</strong></li>
            <li>Choose <strong>Desktop app</strong>, name it anything, click <strong>Create</strong></li>
            <li>Click <strong>Download JSON</strong> and save the file as <code className="bg-amber-100 px-1 rounded">google_credentials.json</code></li>
            <li>Move that file into <code className="bg-amber-100 px-1 rounded">SocialMediaAgent\backend\</code></li>
            <li>Restart the backend, then click: <a href="http://localhost:8000/api/drive/auth" target="_blank" rel="noreferrer" className="underline font-semibold">Authorize Google Drive →</a></li>
            <li>A browser window will open — sign in and allow access. Done!</li>
          </ol>
        </details>
      )}
    </div>
  )
}

// ─── Main MediaLibrary page ───────────────────────────────────────────────────
export default function MediaLibrary({ onSelectUrl }) {
  const [tab, setTab] = useState('drive')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
        <p className="text-gray-500 text-sm mt-1">Browse Google Drive files or upload directly to the app.</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('drive')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab==='drive' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          <span>📁</span> Google Drive
        </button>
        <button onClick={() => setTab('uploaded')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab==='uploaded' ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          <Upload size={15} /> Uploaded
        </button>
      </div>

      {tab === 'drive'
        ? <GoogleDriveBrowser onSelectUrl={onSelectUrl} />
        : <UploadedMedia onSelectUrl={onSelectUrl} />}
    </div>
  )
}
