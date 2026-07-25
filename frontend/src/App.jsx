import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './components/Dashboard'
import ContentGenerator from './components/ContentGenerator'
import BlogRepurposer from './components/BlogRepurposer'
import MediaLibrary from './components/MediaLibrary'
import PostQueue from './components/PostQueue'
import CalendarView from './components/CalendarView'
import PlatformSettings from './components/PlatformSettings'
import Library from './components/Library'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/generate" element={<ContentGenerator />} />
          <Route path="/blog" element={<BlogRepurposer />} />
          <Route path="/media" element={<MediaLibrary />} />
          <Route path="/library" element={<Library />} />
          <Route path="/queue" element={<PostQueue />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/settings" element={<PlatformSettings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
