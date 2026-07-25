import { useState, useEffect } from 'react'
import { getBlogPosts, createBlogPost, deleteBlogPost, repurposeBlog, createPost } from '../api/client'
import toast from 'react-hot-toast'
import { BookOpen, Sparkles, Trash2, PlusCircle, Facebook, Instagram, Linkedin } from 'lucide-react'

const PLATFORM_ICONS = {
  facebook:  <Facebook  size={14} className="text-blue-600" />,
  instagram: <Instagram size={14} className="text-pink-500" />,
  linkedin:  <Linkedin  size={14} className="text-blue-700" />,
}

export default function BlogRepurposer() {
  const [blogs, setBlogs] = useState([])
  const [selected, setSelected] = useState(null)
  const [newBlog, setNewBlog] = useState({ title: '', content: '' })
  const [adding, setAdding] = useState(false)
  const [platforms, setPlatforms] = useState(['facebook', 'instagram', 'linkedin'])
  const [segment, setSegment] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchBlogs() }, [])

  const fetchBlogs = () => {
    getBlogPosts().then(r => setBlogs(r.data.posts)).catch(console.error)
  }

  const addBlog = async () => {
    if (!newBlog.title || !newBlog.content) { toast.error('Title and content required'); return }
    setSaving(true)
    try {
      await createBlogPost(newBlog)
      setNewBlog({ title: '', content: '' })
      setAdding(false)
      fetchBlogs()
      toast.success('Blog post saved')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const removeBlog = async (id) => {
    try {
      await deleteBlogPost(id)
      setBlogs(b => b.filter(x => x.id !== id))
      if (selected?.id === id) setSelected(null)
      toast.success('Deleted')
    } catch { toast.error('Failed to delete') }
  }

  const repurpose = async () => {
    if (!selected) { toast.error('Select a blog post first'); return }
    if (!platforms.length) { toast.error('Select at least one platform'); return }
    setLoading(true)
    setResults(null)
    try {
      const res = await repurposeBlog({
        blog_id: selected.id,
        platforms,
        target_segment: segment || null,
      })
      setResults(res.data.data)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Repurpose failed')
    } finally {
      setLoading(false)
    }
  }

  const saveToQueue = async (platform, postData) => {
    try {
      await createPost({
        caption: postData.caption,
        hashtags: postData.hashtags,
        platform,
        content_type: 'text',
        source_blog_id: selected?.id,
        title: selected?.title,
      })
      toast.success(`Saved to ${platform} queue`)
    } catch { toast.error('Failed to save') }
  }

  const togglePlatform = (p) => setPlatforms(ps =>
    ps.includes(p) ? ps.filter(x => x !== p) : [...ps, p]
  )

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blog Repurposer</h1>
          <p className="text-gray-500 text-sm mt-1">Convert blog articles into platform-specific social posts.</p>
        </div>
        <button onClick={() => setAdding(a => !a)} className="btn-secondary flex items-center gap-2 text-sm">
          <PlusCircle size={16} /> Add Blog Post
        </button>
      </div>

      {/* Add Blog Form */}
      {adding && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Add Blog Article</h2>
          <div>
            <label className="label">Title</label>
            <input className="input" value={newBlog.title} onChange={e => setNewBlog(b => ({ ...b, title: e.target.value }))} placeholder="Blog post title" />
          </div>
          <div>
            <label className="label">Content</label>
            <textarea className="input resize-none" rows={8} value={newBlog.content} onChange={e => setNewBlog(b => ({ ...b, content: e.target.value }))} placeholder="Paste the full blog content here…" />
          </div>
          <div className="flex gap-3">
            <button onClick={addBlog} disabled={saving} className="btn-primary text-sm">Save Article</button>
            <button onClick={() => setAdding(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Blog List */}
        <div className="card lg:col-span-1 h-fit">
          <h2 className="font-semibold text-gray-900 mb-3">Blog Library</h2>
          {blogs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No blog posts yet</p>
          ) : (
            <div className="space-y-2">
              {blogs.map(b => (
                <div
                  key={b.id}
                  onClick={() => { setSelected(b); setResults(null) }}
                  className={`p-3 rounded-lg cursor-pointer group transition-colors ${
                    selected?.id === b.id ? 'bg-brand-50 border border-brand-200' : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">{b.title}</p>
                      {b.repurposed && <span className="text-xs text-green-600">✓ Repurposed</span>}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); removeBlog(b.id) }}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Repurpose Panel */}
        <div className="lg:col-span-2 space-y-6">
          {selected ? (
            <div className="card space-y-5">
              <div className="flex items-start gap-3">
                <BookOpen size={20} className="text-brand-500 mt-0.5 shrink-0" />
                <div>
                  <h2 className="font-semibold text-gray-900">{selected.title}</h2>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-3">{selected.excerpt}</p>
                </div>
              </div>

              {/* Platforms */}
              <div>
                <label className="label">Target Platforms</label>
                <div className="flex gap-3">
                  {['facebook', 'instagram', 'linkedin'].map(p => (
                    <button key={p} onClick={() => togglePlatform(p)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        platforms.includes(p) ? 'bg-brand-50 border-brand-400 text-brand-700' : 'bg-white border-gray-200 text-gray-500'
                      }`}
                    >
                      {PLATFORM_ICONS[p]} {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Target Segment (optional)</label>
                <select className="input" value={segment} onChange={e => setSegment(e.target.value)}>
                  <option value="">All Audiences</option>
                  {['Empty Nesters','Growing Families','Job Relocators','Life Transitions','Long-Term Owners','Accidental Landlords'].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <button onClick={repurpose} disabled={loading} className="btn-primary flex items-center gap-2 w-full justify-center py-3">
                <Sparkles size={18} />
                {loading ? 'Repurposing…' : 'Repurpose into Social Posts'}
              </button>
            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <BookOpen size={36} className="text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">Select a blog post from the library to repurpose it.</p>
            </div>
          )}

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
      </div>
    </div>
  )
}
