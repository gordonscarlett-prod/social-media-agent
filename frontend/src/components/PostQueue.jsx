import { useState, useEffect } from 'react'
import { getPosts, publishNow, deletePost, updatePost, markPublished } from '../api/client'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { Send, Trash2, Edit2, Facebook, Instagram, Linkedin, CheckCircle, Clock, AlertCircle, FileEdit, BadgeCheck, FolderOpen, X } from 'lucide-react'
import { GoogleDriveBrowser } from './MediaLibrary'

const PLATFORM_ICONS = {
  facebook:  <Facebook  size={14} className="text-blue-600" />,
  instagram: <Instagram size={14} className="text-pink-500" />,
  linkedin:  <Linkedin  size={14} className="text-blue-700" />,
}

const STATUS_BADGE = {
  draft:     'badge-draft',
  scheduled: 'badge-scheduled',
  published: 'badge-published',
  failed:    'badge-failed',
}

const STATUS_ICON = {
  draft:     <FileEdit   size={14} className="text-gray-500"  />,
  scheduled: <Clock      size={14} className="text-blue-500"  />,
  published: <CheckCircle size={14} className="text-green-500" />,
  failed:    <AlertCircle size={14} className="text-red-500"   />,
}

export default function PostQueue() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [publishing, setPublishing] = useState({})
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => { fetchPosts() }, [])

  const fetchPosts = () => {
    setLoading(true)
    getPosts().then(r => setPosts(r.data.posts)).catch(console.error).finally(() => setLoading(false))
  }

  const publish = async (id) => {
    setPublishing(p => ({ ...p, [id]: true }))
    try {
      await publishNow(id)
      toast.success('Published!')
      fetchPosts()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Publish failed')
    } finally {
      setPublishing(p => ({ ...p, [id]: false }))
    }
  }

  const remove = async (id) => {
    if (!confirm('Delete this post?')) return
    try {
      await deletePost(id)
      setPosts(p => p.filter(x => x.id !== id))
      toast.success('Deleted')
    } catch { toast.error('Failed to delete') }
  }

  const startEdit = (post) => {
    setEditing(post.id)
    setEditForm({
      caption: post.caption,
      hashtags: post.hashtags || '',
      scheduled_at: post.scheduled_at ? post.scheduled_at.slice(0, 16) : '',
      media_url: post.media_url || '',
      content_type: post.content_type || 'text',
    })
  }

  const saveEdit = async (id) => {
    try {
      const payload = {}
      if (editForm.caption)      payload.caption       = editForm.caption
      if (editForm.hashtags)     payload.hashtags      = editForm.hashtags
      if (editForm.media_url)    payload.media_url     = editForm.media_url
      if (editForm.content_type) payload.content_type  = editForm.content_type
      if (editForm.scheduled_at) payload.scheduled_at  = new Date(editForm.scheduled_at).toISOString()
      await updatePost(id, payload)
      toast.success('Updated')
      setEditing(null)
      fetchPosts()
    } catch (e) {
      const msg = e.response?.data?.detail || 'Update failed'
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    }
  }

  const needsMedia = (post) =>
    post.platform === 'instagram' &&
    post.status !== 'published' &&
    !post.media_url

  const statuses = ['all', 'draft', 'scheduled', 'published', 'failed']
  const platforms = ['all', 'facebook', 'instagram', 'linkedin']

  const filtered = posts.filter(p =>
    (filter === 'all' || p.status === filter) &&
    (platformFilter === 'all' || p.platform === platformFilter)
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Post Queue</h1>
        <p className="text-gray-500 text-sm mt-1">Manage all your scheduled, draft, and published posts.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
          {statuses.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                filter === s ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
          {platforms.map(p => (
            <button key={p} onClick={() => setPlatformFilter(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize flex items-center gap-1 ${
                platformFilter === p ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p !== 'all' && PLATFORM_ICONS[p]} {p}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">No posts found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(post => (
            <div key={post.id} className="card">
              {editing === post.id ? (
                <div className="space-y-3">
                  <textarea className="input resize-none" rows={4} value={editForm.caption} onChange={e => setEditForm(f => ({ ...f, caption: e.target.value }))} />
                  <input className="input" value={editForm.hashtags} onChange={e => setEditForm(f => ({ ...f, hashtags: e.target.value }))} placeholder="Hashtags" />
                  <input type="datetime-local" className="input" value={editForm.scheduled_at} onChange={e => setEditForm(f => ({ ...f, scheduled_at: e.target.value }))} />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs">Content Type</label>
                      <select className="input" value={editForm.content_type} onChange={e => setEditForm(f => ({ ...f, content_type: e.target.value }))}>
                        <option value="text">Text</option>
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                        <option value="reel">Reel</option>
                        <option value="carousel">Carousel</option>
                      </select>
                    </div>
                    <div>
                      <label className="label text-xs">Media URL {post.platform === 'instagram' && <span className="text-pink-600 font-semibold">* Required for Instagram</span>}</label>
                      <div className="flex gap-2">
                        <input className="input" value={editForm.media_url} onChange={e => setEditForm(f => ({ ...f, media_url: e.target.value }))} placeholder="https://drive.google.com/uc?export=download&id=..." />
                        <button type="button" onClick={() => setPickerOpen(true)} title="Browse Google Drive" className="btn-secondary shrink-0 px-3">
                          <FolderOpen size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(post.id)} className="btn-primary text-sm">Save</button>
                    <button onClick={() => setEditing(null)} className="btn-secondary text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                {needsMedia(post) && (
                  <div className="flex items-center gap-2 bg-pink-50 border border-pink-200 rounded-lg px-3 py-2 text-sm text-pink-800">
                    <AlertCircle size={15} className="text-pink-500 shrink-0" />
                    <span><strong>Instagram requires an image or video.</strong> Click the edit icon to add a Media URL before publishing.</span>
                  </div>
                )}
                <div className="flex items-start gap-4">
                  <div className="mt-1">{PLATFORM_ICONS[post.platform]}</div>
                  <div className="flex-1 min-w-0 space-y-1">
                    {post.title && <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide">{post.title}</p>}
                    <p className="text-sm text-gray-900 line-clamp-3">{post.caption}</p>
                    {post.hashtags && <p className="text-xs text-brand-500">{post.hashtags}</p>}
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <span className={STATUS_BADGE[post.status]}>{STATUS_ICON[post.status]}<span className="ml-1">{post.status}</span></span>
                      <span className="text-xs text-gray-400 capitalize">{post.content_type}</span>
                      {post.scheduled_at && (
                        <span className="text-xs text-gray-400">
                          {format(new Date(post.scheduled_at), 'MMM d, yyyy · h:mm a')}
                        </span>
                      )}
                      {post.published_at && (
                        <span className="text-xs text-green-500">
                          Published {format(new Date(post.published_at), 'MMM d, yyyy')}
                        </span>
                      )}
                      {post.error_message && (
                        <span className="text-xs text-red-400">Error: {post.error_message}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {post.status !== 'published' && (
                      <>
                        <button onClick={() => startEdit(post)} title="Edit" className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                          <Edit2 size={15} />
                        </button>
                        <button onClick={() => publish(post.id)} disabled={publishing[post.id]} title="Publish now" className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                          <Send size={15} />
                        </button>
                        <button
                          title="Mark as already published"
                          onClick={async () => {
                            await markPublished(post.id)
                            toast.success('Marked as published')
                            fetchPosts()
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <BadgeCheck size={15} />
                        </button>
                      </>
                    )}
                    <button onClick={() => remove(post.id)} title="Delete" className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {pickerOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setPickerOpen(false)}>
          <div className="bg-gray-50 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-6 relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPickerOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Choose media from Google Drive</h2>
            <GoogleDriveBrowser onSelectUrl={(url) => {
              setEditForm(f => ({ ...f, media_url: url }))
              setPickerOpen(false)
              toast.success('Media URL set on post')
            }} />
          </div>
        </div>
      )}
    </div>
  )
}
