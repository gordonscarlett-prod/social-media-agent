import { useState, useEffect } from 'react'
import { getPosts, generateCalendar, createPost } from '../api/client'
import toast from 'react-hot-toast'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, Sparkles, Facebook, Instagram, Linkedin } from 'lucide-react'

const PLATFORM_COLORS = {
  facebook:  'bg-blue-100 text-blue-700 border-blue-200',
  instagram: 'bg-pink-100 text-pink-700 border-pink-200',
  linkedin:  'bg-sky-100 text-sky-700 border-sky-200',
}

const PLATFORM_ICONS = {
  facebook:  <Facebook  size={10} />,
  instagram: <Instagram size={10} />,
  linkedin:  <Linkedin  size={10} />,
}

export default function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [posts, setPosts] = useState([])
  const [selectedDay, setSelectedDay] = useState(null)
  const [showGenerator, setShowGenerator] = useState(false)
  const [genLoading, setGenLoading] = useState(false)
  const [genForm, setGenForm] = useState({ platforms: ['facebook','instagram','linkedin'], posts_per_week: 3 })
  const [calendarIdeas, setCalendarIdeas] = useState([])

  useEffect(() => { fetchPosts() }, [])

  const fetchPosts = () => {
    getPosts().then(r => setPosts(r.data.posts)).catch(console.error)
  }

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  })

  const postsForDay = (day) =>
    posts.filter(p => p.scheduled_at && isSameDay(new Date(p.scheduled_at), day))

  const selectedDayPosts = selectedDay ? postsForDay(selectedDay) : []

  const generateAICalendar = async () => {
    setGenLoading(true)
    setCalendarIdeas([])
    try {
      const res = await generateCalendar({
        month: format(currentMonth, 'MMMM'),
        year: currentMonth.getFullYear(),
        platforms: genForm.platforms,
        posts_per_week: genForm.posts_per_week,
      })
      setCalendarIdeas(res.data.data)
      toast.success(`Generated ${res.data.data.length} post ideas`)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Calendar generation failed')
    } finally {
      setGenLoading(false)
    }
  }

  const saveIdea = async (idea) => {
    try {
      await createPost({
        title: idea.topic,
        caption: idea.brief,
        platform: idea.platform,
        content_type: idea.content_type,
      })
      toast.success('Saved as draft')
    } catch { toast.error('Failed to save') }
  }

  const togglePlatform = (p) => setGenForm(f => ({
    ...f,
    platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p]
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Calendar</h1>
          <p className="text-gray-500 text-sm mt-1">Visualize and manage your posting schedule.</p>
        </div>
        <button onClick={() => setShowGenerator(g => !g)} className="btn-secondary flex items-center gap-2 text-sm">
          <Sparkles size={16} /> AI Generate Month
        </button>
      </div>

      {/* AI Calendar Generator */}
      {showGenerator && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Generate Content Calendar — {format(currentMonth, 'MMMM yyyy')}</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="label">Platforms</label>
              <div className="flex gap-2">
                {['facebook','instagram','linkedin'].map(p => (
                  <button key={p} onClick={() => togglePlatform(p)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      genForm.platforms.includes(p) ? 'bg-brand-50 border-brand-400 text-brand-700' : 'bg-white border-gray-200 text-gray-500'
                    }`}
                  >
                    {PLATFORM_ICONS[p]} {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Posts/week</label>
              <select className="input w-24" value={genForm.posts_per_week} onChange={e => setGenForm(f => ({ ...f, posts_per_week: +e.target.value }))}>
                {[2,3,4,5,7].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button onClick={generateAICalendar} disabled={genLoading} className="btn-primary flex items-center gap-2 text-sm">
              <Sparkles size={15} /> {genLoading ? 'Generating…' : 'Generate'}
            </button>
          </div>

          {calendarIdeas.length > 0 && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {calendarIdeas.map((idea, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium border ${PLATFORM_COLORS[idea.platform] || 'bg-gray-100 text-gray-600'}`}>
                    {idea.platform}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">Week {idea.week} · {idea.day}</p>
                    <p className="text-sm text-gray-700">{idea.topic}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{idea.brief}</p>
                  </div>
                  <button onClick={() => saveIdea(idea)} className="shrink-0 text-xs btn-secondary py-1 px-2">Save Draft</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="card lg:col-span-2">
          {/* Month Nav */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronLeft size={18} />
            </button>
            <h2 className="font-semibold text-gray-900">{format(currentMonth, 'MMMM yyyy')}</h2>
            <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="text-xs font-medium text-gray-400 text-center py-1">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-lg overflow-hidden">
            {/* Empty cells before month start */}
            {Array.from({ length: days[0].getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-gray-50 h-20" />
            ))}
            {days.map(day => {
              const dayPosts = postsForDay(day)
              const isToday = isSameDay(day, new Date())
              const isSelected = selectedDay && isSameDay(day, selectedDay)
              return (
                <div
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`bg-white h-20 p-1.5 cursor-pointer hover:bg-brand-50 transition-colors ${isSelected ? 'ring-2 ring-brand-500 ring-inset' : ''}`}
                >
                  <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                    isToday ? 'bg-brand-600 text-white' : 'text-gray-700'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {dayPosts.slice(0, 3).map(p => (
                      <div key={p.id} className={`text-[10px] px-1 py-0.5 rounded truncate flex items-center gap-0.5 ${PLATFORM_COLORS[p.platform] || 'bg-gray-100 text-gray-600'}`}>
                        {PLATFORM_ICONS[p.platform]}
                        <span className="truncate">{p.title || p.caption?.slice(0, 20)}</span>
                      </div>
                    ))}
                    {dayPosts.length > 3 && <div className="text-[10px] text-gray-400">+{dayPosts.length - 3} more</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Day Detail */}
        <div className="card h-fit">
          <h2 className="font-semibold text-gray-900 mb-3">
            {selectedDay ? format(selectedDay, 'MMMM d, yyyy') : 'Select a day'}
          </h2>
          {!selectedDay ? (
            <p className="text-sm text-gray-400">Click a day to see scheduled posts.</p>
          ) : selectedDayPosts.length === 0 ? (
            <p className="text-sm text-gray-400">No posts scheduled.</p>
          ) : (
            <div className="space-y-3">
              {selectedDayPosts.map(p => (
                <div key={p.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    {PLATFORM_ICONS[p.platform]}
                    <span className="text-xs font-medium capitalize text-gray-600">{p.platform}</span>
                    <span className={`badge ml-auto ${{draft:'badge-draft',scheduled:'badge-scheduled',published:'badge-published',failed:'badge-failed'}[p.status]}`}>{p.status}</span>
                  </div>
                  <p className="text-sm text-gray-800 line-clamp-3">{p.caption}</p>
                  {p.scheduled_at && (
                    <p className="text-xs text-gray-400 mt-1">{format(new Date(p.scheduled_at), 'h:mm a')}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
