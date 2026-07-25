import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Sparkles, BookOpen, Image, ListChecks, Calendar, Settings, Library
} from 'lucide-react'

const links = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/generate',  icon: Sparkles,        label: 'Create Post' },
  { to: '/blog',      icon: BookOpen,        label: 'Blog'        },
  { to: '/media',     icon: Image,           label: 'Media'       },
  { to: '/library',   icon: Library,         label: 'Library'     },
  { to: '/queue',     icon: ListChecks,      label: 'Queue'       },
  { to: '/calendar',  icon: Calendar,        label: 'Calendar'    },
  { to: '/settings',  icon: Settings,        label: 'Settings'    },
]

export default function Navbar() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold text-sm">EM</div>
          <span className="font-semibold text-gray-900 hidden sm:block">Erin Menard Properties</span>
          <span className="text-xs text-brand-600 font-medium bg-brand-50 px-2 py-0.5 rounded-full hidden sm:block">Social Agent</span>
        </div>

        <nav className="flex items-center gap-1">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <Icon size={16} />
              <span className="hidden md:block">{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
