import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

// Posts
export const getPosts = (params) => api.get('/posts', { params })
export const createPost = (data) => api.post('/posts', data)
export const updatePost = (id, data) => api.put(`/posts/${id}`, data)
export const deletePost = (id) => api.delete(`/posts/${id}`)
export const publishNow = (id) => api.post(`/posts/${id}/publish`)
export const schedulePost = (id, scheduled_at) => api.post(`/posts/${id}/schedule`, { scheduled_at })
export const markPublished = (id) => api.post(`/posts/${id}/mark-published`)

// AI Generation
export const generatePost = (data) => api.post('/generate', data)
export const generateMultiPlatform = (data) => api.post('/generate/multi-platform', data)
export const repurposeBlog = (data) => api.post('/generate/repurpose-blog', data)
export const generateCalendar = (data) => api.post('/generate/content-calendar', data)

// Media
export const getMedia = () => api.get('/media')
export const uploadMedia = (formData) =>
  api.post('/media', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
export const deleteMedia = (id) => api.delete(`/media/${id}`)

// Blog
export const getBlogPosts = () => api.get('/blog')
export const createBlogPost = (data) => api.post('/blog', data)
export const deleteBlogPost = (id) => api.delete(`/blog/${id}`)

// Platforms
export const getPlatforms = () => api.get('/platforms')
export const savePlatformConfig = (platform, data) => api.post(`/platforms/${platform}`, data)

// Dashboard
export const getDashboard = () => api.get('/dashboard')

// Resource Library
export const getLibraryStatus = () => api.get('/library/status')
export const getLibrarySources = () => api.get('/library/sources')
export const addLibrarySource = (data) => api.post('/library/sources', data)
export const deleteLibrarySource = (id) => api.delete(`/library/sources/${id}`)
export const browseLibraryFolder = (folder_id) => api.get('/library/browse', { params: { folder_id } })
export const getLibrarySegments = (source_id) => api.get('/library/segments', { params: { source_id } })
export const getLibrarySegmentDetail = (folder_id, refresh = false) =>
  api.get(`/library/segments/${folder_id}`, { params: { refresh } })
