import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDashboard } from '../api/client'
import { format } from 'date-fns'
import {
  Sparkles, BookOpen, Image, ListChecks, Calendar,
  Facebook, Instagram, Linkedin, Clock, CheckCircle, AlertCircle, FileEdit
} from 'lucide-react'

const PLATFORM_ICONS = {
  facebook:  <Facebook  size={14} className="text-blue-600" />,
  instagram: <Instagram size={14} className="text-pink-500" />,
  linkedin:  <Linkedin  size={14} className="text-blue-700" />,
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboard()
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center py-20 text-gray-400">Loading dashboard…</div>

  const { stats, upcoming_posts } = data

  const statCards = [
    { label: 'Published',  value: stats.published,      icon: <CheckCircle size={20} className="text-green-500" /> },
    { label: 'Scheduled',  value: stats.scheduled,      icon: <Clock       size={20} className="text-blue-500"  /> },
    { label: 'Drafts',     value: stats.drafts,         icon: <FileEdit    size={20} className="text-gray-500"  /> },
    { label: 'Failed',     value: stats.failed,         icon: <AlertCircle size={20} className="text-red-500"   /> },
    { label: 'Blog Posts', value: stats.blog_articles,  icon: <BookOpen    size={20} className="text-brand-500" /> },
    { label: 'Media Files',value: stats.media_assets,   icon: <Image       size={20} className="text-purple-500"/> },
  ]

  const quickActions = [
    { to: '/generate', icon: <Sparkles size={18}/>, label: 'Create Post',    desc: 'AI-generate a new post'        },
    { to: '/blog',     icon: <BookOpen size={18}/>, label: 'Repurpose Blog', desc: 'Turn a blog into social posts' },
    { to: '/media',    icon: <Image    size={18}/>, label: 'Upload Media',   desc: 'Add images or videos'          },
    { to: '/calendar', icon: <Calendar size={18}/>, label: 'View Calendar',  desc: 'See scheduled content'         },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Welcome back, Erin. Here's your social media overview.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map(({ label, value, icon }) => (
          <div key={label} className="card flex flex-col items-center text-center gap-2 py-4">
            {icon}
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="card lg:col-span-1">
          <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {quickActions.map(({ to, icon, label, desc }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-brand-50 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover:bg-brand-200 transition-colors">
                  {icon}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{label}</div>
                  <div className="text-xs text-gray-500">{desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Upcoming Posts */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Upcoming Posts</h2>
            <Link to="/queue" className="text-sm text-brand-600 hover:underline">View all</Link>
          </div>
          {upcoming_posts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Clock size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No scheduled posts yet</p>
              <Link to="/generate" className="text-brand-600 text-sm hover:underline mt-1 inline-block">
                Create your first post
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming_posts.map(post => (
                <div key={post.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <div className="mt-0.5">{PLATFORM_ICONS[post.platform]}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 line-clamp-2">{post.caption}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {post.scheduled_at && format(new Date(post.scheduled_at), 'MMM d, yyyy · h:mm a')}
                    </p>
                  </div>
                  <span className="badge-scheduled shrink-0">{post.content_type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
