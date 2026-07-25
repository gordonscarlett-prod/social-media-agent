import { useState, useEffect } from 'react'
import {
  getLibraryStatus, getLibrarySources, addLibrarySource, deleteLibrarySource,
  browseLibraryFolder, getLibrarySegments, getLibrarySegmentDetail,
} from '../api/client'
import toast from 'react-hot-toast'
import {
  Library as LibraryIcon, Folder, FileText, File, Image as ImageIcon,
  ExternalLink, ChevronDown, ChevronRight, ChevronLeft, RefreshCw,
  Plus, Trash2, X, AlertCircle, Mail, Megaphone, Users,
} from 'lucide-react'

const CATEGORY_LABELS = {
  segments: 'Audience Segments',
  whitepapers: 'White Papers',
  generic: 'Resources',
}

function fileIcon(mimeType, name = '') {
  if (mimeType === 'application/vnd.google-apps.folder') return <Folder size={16} className="text-amber-500" />
  if (mimeType === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) return <FileText size={16} className="text-red-500" />
  if (mimeType?.startsWith('image/')) return <ImageIcon size={16} className="text-purple-500" />
  if (mimeType?.includes('document') || mimeType?.includes('word')) return <FileText size={16} className="text-blue-500" />
  return <File size={16} className="text-gray-400" />
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const TYPE_ICONS = {
  email: <Mail size={14} className="text-blue-500" />,
  flyer: <Megaphone size={14} className="text-amber-500" />,
}

// ─────────────────────────────────────────────
// Generic folder browser (white papers / custom resources)
// ─────────────────────────────────────────────
function FolderBrowser({ rootId, rootName }) {
  const [stack, setStack] = useState([{ id: rootId, name: rootName }])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const current = stack[stack.length - 1]

  useEffect(() => { load(current.id) }, [current.id])

  const load = (folderId) => {
    setLoading(true)
    setError(null)
    browseLibraryFolder(folderId)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Failed to load folder'))
      .finally(() => setLoading(false))
  }

  const open = (folder) => setStack(s => [...s, { id: folder.id, name: folder.name }])
  const goTo = (idx) => setStack(s => s.slice(0, idx + 1))

  return (
    <div className="space-y-3">
      {/* Breadcrumb */}
      <div className="flex items-center flex-wrap gap-1 text-sm">
        {stack.length > 1 && (
          <button onClick={() => setStack(s => s.slice(0, -1))} className="p-1 text-gray-400 hover:text-brand-600 rounded">
            <ChevronLeft size={16} />
          </button>
        )}
        {stack.map((s, idx) => (
          <span key={s.id} className="flex items-center gap-1">
            {idx > 0 && <span className="text-gray-300">/</span>}
            <button
              onClick={() => goTo(idx)}
              className={`hover:text-brand-600 ${idx === stack.length - 1 ? 'font-semibold text-gray-800' : 'text-gray-500'}`}
            >
              {s.name}
            </button>
          </span>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
          <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-400 py-6 text-center">Loading…</div>
      ) : data ? (
        <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
          {data.folders.length === 0 && data.files.length === 0 && (
            <div className="text-sm text-gray-400 py-6 text-center">This folder is empty.</div>
          )}
          {data.folders.map(f => (
            <button
              key={f.id}
              onClick={() => open(f)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
            >
              {fileIcon(f.mimeType)}
              <span className="flex-1 font-medium text-gray-800">{f.name}</span>
              <ChevronRight size={14} className="text-gray-300" />
            </button>
          ))}
          {data.files.map(f => (
            <a
              key={f.id}
              href={f.view_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
            >
              {fileIcon(f.mimeType, f.name)}
              <span className="flex-1 text-gray-700">{f.name}</span>
              {f.size != null && <span className="text-xs text-gray-400">{formatSize(f.size)}</span>}
              <ExternalLink size={13} className="text-gray-300" />
            </a>
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ─────────────────────────────────────────────
// Segment card (brief summary + cadence + files)
// ─────────────────────────────────────────────
function SegmentCard({ segment }) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = (refresh = false) => {
    setLoading(true)
    setError(null)
    getLibrarySegmentDetail(segment.id, refresh)
      .then(r => setDetail(r.data))
      .catch(e => setError(e.response?.data?.detail || 'Failed to load segment'))
      .finally(() => setLoading(false))
  }

  const toggle = () => {
    setOpen(o => !o)
    if (!detail && !loading) load()
  }

  const niceName = segment.name.replace(/^SEG-/i, '')

  return (
    <div className="card">
      <button onClick={toggle} className="w-full flex items-center gap-3 text-left">
        <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
          <Users size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{niceName}</p>
          {detail?.summary && !open && (
            <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{detail.summary}</p>
          )}
        </div>
        {open ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
      </button>

      {open && (
        <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
          {loading ? (
            <div className="text-sm text-gray-400 text-center py-4">Loading…</div>
          ) : error ? (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
            </div>
          ) : detail ? (
            <>
              {detail.summary && <p className="text-sm text-gray-600">{detail.summary}</p>}

              {detail.cadence?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cadence</p>
                  <div className="space-y-2">
                    {detail.cadence.map((c, i) => (
                      <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2 text-sm">
                        <div className="shrink-0">{TYPE_ICONS[c.type] || <FileText size={14} className="text-gray-400" />}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">{c.subject || c.step}</p>
                          <p className="text-xs text-gray-400">{c.step}{c.timing ? ` · ${c.timing}` : ''}</p>
                        </div>
                        {c.file && (
                          <a href={c.file.view_url} target="_blank" rel="noreferrer"
                             className="shrink-0 text-brand-600 hover:text-brand-700" title={`Open ${c.file.name}`}>
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">All Files</p>
                  <button onClick={() => load(true)} className="text-xs text-gray-400 hover:text-brand-600 flex items-center gap-1">
                    <RefreshCw size={12} /> Refresh
                  </button>
                </div>
                <div className="space-y-1">
                  {detail.files.map(f => (
                    <a key={f.id} href={f.view_url} target="_blank" rel="noreferrer"
                       className="flex items-center gap-2 text-sm text-gray-700 hover:text-brand-600 px-2 py-1 rounded hover:bg-gray-50">
                      {fileIcon(f.mimeType, f.name)}
                      <span className="flex-1 truncate">{f.name}</span>
                      <ExternalLink size={12} className="text-gray-300" />
                    </a>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Segments section (whole source)
// ─────────────────────────────────────────────
function SegmentsSection({ source }) {
  const [segments, setSegments] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getLibrarySegments(source.id)
      .then(r => setSegments(r.data.segments))
      .catch(e => setError(e.response?.data?.detail || 'Failed to load segments'))
  }, [source.id])

  if (error) {
    return (
      <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
        <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
      </div>
    )
  }

  if (!segments) return <div className="text-sm text-gray-400 py-6 text-center">Loading segments…</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {segments.map(s => <SegmentCard key={s.id} segment={s} />)}
    </div>
  )
}

// ─────────────────────────────────────────────
// Add source modal
// ─────────────────────────────────────────────
function AddSourceModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ name: '', drive_url: '', category: 'generic', description: '' })
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.drive_url) return
    setSaving(true)
    try {
      await addLibrarySource(form)
      toast.success('Resource folder added')
      onAdded()
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Add Resource Folder</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label text-xs">Name</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Listing Templates" />
          </div>
          <div>
            <label className="label text-xs">Google Drive Folder Link</label>
            <input className="input" value={form.drive_url} onChange={e => setForm(f => ({ ...f, drive_url: e.target.value }))} placeholder="https://drive.google.com/drive/folders/..." />
          </div>
          <div>
            <label className="label text-xs">Type</label>
            <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              <option value="generic">Browsable folder</option>
              <option value="segments">Audience segments (with cadence briefs)</option>
              <option value="whitepapers">Document library</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">Description (optional)</label>
            <input className="input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? 'Adding…' : 'Add'}</button>
            <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Main Library page
// ─────────────────────────────────────────────
export default function Library() {
  const [status, setStatus] = useState(null)
  const [sources, setSources] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  const fetchAll = () => {
    getLibraryStatus().then(r => setStatus(r.data)).catch(() => {})
    getLibrarySources().then(r => setSources(r.data.sources)).catch(() => {})
  }

  useEffect(() => { fetchAll() }, [])

  const removeSource = async (id) => {
    if (!confirm('Remove this resource folder from the Library?')) return
    try {
      await deleteLibrarySource(id)
      toast.success('Removed')
      fetchAll()
    } catch {
      toast.error('Failed to remove')
    }
  }

  const blocked = status && (!status.has_credentials || !status.is_authenticated)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <LibraryIcon size={24} className="text-brand-600" /> Resource Library
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Quick access to segment marketing materials, white papers, and other shared Drive folders.
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm flex items-center gap-1.5">
          <Plus size={15} /> Add Folder
        </button>
      </div>

      {status && blocked && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <div>
            {!status.has_credentials ? (
              <p>Google Drive isn't set up yet. Add <code>google_credentials.json</code> to the backend folder, then visit <code>/api/drive/auth</code>.</p>
            ) : status.needs_reauth ? (
              <p>Google Drive needs an extra permission to browse these folders. Visit <a className="underline font-medium" href="http://localhost:8000/api/drive/auth" target="_blank" rel="noreferrer">/api/drive/auth</a> on the server and approve the new access.</p>
            ) : (
              <p>Google Drive isn't authenticated yet. Visit <a className="underline font-medium" href="http://localhost:8000/api/drive/auth" target="_blank" rel="noreferrer">/api/drive/auth</a> on the server.</p>
            )}
          </div>
        </div>
      )}

      {sources === null ? (
        <div className="text-center py-20 text-gray-400">Loading…</div>
      ) : sources.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">No resource folders yet. Click "Add Folder" to get started.</div>
      ) : (
        <div className="space-y-6">
          {sources.map(source => (
            <div key={source.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{source.name}</h2>
                  {source.description && <p className="text-sm text-gray-500">{source.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{CATEGORY_LABELS[source.category] || 'Resources'}</span>
                  <a
                    href={`https://drive.google.com/drive/folders/${source.drive_folder_id}`}
                    target="_blank" rel="noreferrer"
                    className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg"
                    title="Open in Google Drive"
                  >
                    <ExternalLink size={15} />
                  </a>
                  <button onClick={() => removeSource(source.id)} title="Remove" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {!blocked && (
                source.category === 'segments' ? (
                  <SegmentsSection source={source} />
                ) : (
                  <div className="card">
                    <FolderBrowser rootId={source.drive_folder_id} rootName={source.name} />
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddSourceModal onClose={() => setShowAdd(false)} onAdded={fetchAll} />}
    </div>
  )
}
