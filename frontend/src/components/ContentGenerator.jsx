import { useState } from 'react'
import { generatePost, generateMultiPlatform, createPost } from '../api/client'
import toast from 'react-hot-toast'
import { Sparkles, Copy, Send, PlusCircle, Facebook, Instagram, Linkedin } from 'lucide-react'
import { format, addDays } from 'date-fns'

const PLATFORMS = ['facebook', 'instagram', 'linkedin']
const PLATFORM_ICONS = {
  facebook:  <Facebook  size={16} className="text-blue-600" />,
  instagram: <Instagram size={16} className="text-pink-500" />,
  linkedin:  <Linkedin  size={16} className="text-blue-700" />,
}
const SEGMENTS = [
  'All Audiences',
  'Empty Nesters',
  'Growing Families',
  'Job Relocators',
  'Life Transitions',
  'Long-Term Owners',
  'Accidental Landlords',
]
const CONTENT_TYPES = ['text', 'image', 'video', 'reel', 'carousel']

export default function ContentGenerator() {
  const [form, setForm] = useState({
    topic: '',
    platforms: ['facebook', 'instagram', 'linkedin'],
    content_type: 'text',
    target_segment: 'All Audiences',
    tone: '',
    media_description: '',
    additional_context: '',
  })
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [scheduling, setScheduling] = useState({})
  const [scheduleTimes, setScheduleTimes] = useState({})

  const togglePlatform = (p) => {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(p)
        ? f.platforms.filter(x => x !== p)
        : [...f.platforms, p],
    }))
  }

  const generate = async () => {
    if (!form.topic.trim()) { toast.error('Enter a topic first'); return }
    if (!form.platforms.length) { toast.error('Select at least one platform'); return }

    setLoading(true)
    setResults(null)
    try {
      const payload = {
        ...form,
        target_segment: form.target_segment === 'All Audiences' ? null : form.target_segment,
      }
      const res = await generateMultiPlatform(payload)
      setResults(res.data.data)
      // Default schedule time: tomorrow at 9am
      const defaultTime = format(addDays(new Date(), 1).setHours(9, 0, 0, 0), "yyyy-MM-dd'T'HH:mm")
      const times = {}
      form.platforms.forEach(p => { times[p] = defaultTime })
      setScheduleTimes(times)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const savePost = async (platform, postData, scheduleTime) => {
    const key = `${platform}-save`
    setScheduling(s => ({ ...s, [key]: true }))
    try {
      const scheduled_at = scheduleTime ? new Date(scheduleTime).toISOString() : null
      await createPost({
        caption: postData.caption,
        hashtags: postData.hashtags,
        platform,
        content_type: form.content_type,
        scheduled_at,
        title: form.topic,
      })
      toast.success(`Saved to ${platform} queue${scheduled_at ? ' — scheduled!' : ''}`)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed')
    } finally {
      setScheduling(s => ({ ...s, [key]: false }))
    }
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create Post</h1>
        <p className="text-gray-500 text-sm mt-1">AI-generate platform-optimized content for Erin Menard Properties.</p>
      </div>

      <div className="card space-y-5">
        {/* Topic */}
        <div>
          <label className="label">Topic or Idea *</label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="e.g. Denver spring market is heating up — inventory is low and rates are softening"
            value={form.topic}
            onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          {/* Content Type */}
          <div>
            <label className="label">Content Type</label>
            <select className="input" value={form.content_type} onChange={e => setForm(f => ({ ...f, content_type: e.target.value }))}>
              {CONTENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>

          {/* Target Segment */}
          <div>
            <label className="label">Target Segment</label>
            <select className="input" value={form.target_segment} onChange={e => setForm(f => ({ ...f, target_segment: e.target.value }))}>
              {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Platforms */}
        <div>
          <label className="label">Platforms</label>
          <div className="flex gap-3">
            {PLATFORMS.map(p => (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  form.platforms.includes(p)
                    ? 'bg-brand-50 border-brand-400 text-brand-700'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                {PLATFORM_ICONS[p]}
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Optional fields */}
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className="label">Tone / Style (optional)</label>
            <input className="input" placeholder="e.g. educational, inspirational, urgent" value={form.tone} onChange={e => setForm(f => ({ ...f, tone: e.target.value }))} />
          </div>
          <div>
            <label className="label">Media Description (optional)</label>
            <input className="input" placeholder="e.g. photo of a Denver skyline at sunset" value={form.media_description} onChange={e => setForm(f => ({ ...f, media_description: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="label">Additional Context (optional)</label>
          <input className="input" placeholder="e.g. mention the new light rail station opening in Thornton" value={form.additional_context} onChange={e => setForm(f => ({ ...f, additional_context: e.target.value }))} />
        </div>

        <button onClick={generate} disabled={loading} className="btn-primary flex items-center gap-2 w-full justify-center py-3">
          <Sparkles size={18} />
          {loading ? 'Generating…' : 'Generate Content'}
        </button>
      </div>

      {/* Results */}
      {results && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Generated Posts</h2>
          {Object.entries(results).map(([platform, post]) => (
            <div key={platform} className="card space-y-4">
              <div className="flex items-center gap-2">
                {PLATFORM_ICONS[platform]}
                <span className="font-semibold capitalize text-gray-900">{platform}</span>
                <span className="text-xs text-gray-400 ml-auto">{post.caption?.length} chars</span>
              </div>

              {/* Hook */}
              {post.hook && (
                <div className="bg-brand-50 rounded-lg px-4 py-2 text-sm text-brand-800 font-medium">
                  Hook: {post.hook}
                </div>
              )}

              {/* Caption */}
              <div>
                <label className="label">Caption</label>
                <div className="relative">
                  <textarea
                    className="input resize-none pr-10"
                    rows={5}
                    value={post.caption}
                    onChange={e => setResults(r => ({ ...r, [platform]: { ...r[platform], caption: e.target.value } }))}
                  />
                  <button onClick={() => copyToClipboard(post.caption)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600">
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              {/* Hashtags */}
              <div>
                <label className="label">Hashtags</label>
                <div className="relative">
                  <input
                    className="input pr-10"
                    value={post.hashtags}
                    onChange={e => setResults(r => ({ ...r, [platform]: { ...r[platform], hashtags: e.target.value } }))}
                  />
                  <button onClick={() => copyToClipboard(post.hashtags)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600">
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              {/* CTA */}
              {post.cta && <p className="text-xs text-gray-500">CTA: <span className="text-gray-700 font-medium">{post.cta}</span></p>}

              {/* Schedule & Save */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
                <div className="flex-1 min-w-[200px]">
                  <label className="label text-xs">Schedule for</label>
                  <input
                    type="datetime-local"
                    className="input text-sm"
                    value={scheduleTimes[platform] || ''}
                    onChange={e => setScheduleTimes(t => ({ ...t, [platform]: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2 pt-5">
                  <button
                    onClick={() => savePost(platform, post, null)}
                    disabled={scheduling[`${platform}-save`]}
                    className="btn-secondary text-sm flex items-center gap-1.5"
                  >
                    <PlusCircle size={15} /> Save as Draft
                  </button>
                  <button
                    onClick={() => savePost(platform, post, scheduleTimes[platform])}
                    disabled={scheduling[`${platform}-save`]}
                    className="btn-primary text-sm flex items-center gap-1.5"
                  >
                    <Send size={15} /> Schedule
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
