import api from './axios.js'

const d = (p) => p.then((r) => r.data.data || {})

export const storiesApi = () => d(api.get('/stories'))
export const userStoriesApi = (userId) => d(api.get(`/stories/user/${userId}`))
export const createStoryApi = (formData, onProgress) =>
  d(api.post('/stories', formData, { timeout: 120000, onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total || e.loaded || 1))) }))
export const viewStoryApi = (id) => d(api.post(`/stories/${id}/view`))
export const storyViewersApi = (id) => d(api.get(`/stories/${id}/viewers`))
export const deleteStoryApi = (id) => d(api.delete(`/stories/${id}`))
export const updateStoryPrivacyApi = (visibility) => d(api.put('/users/story-privacy', { visibility }))
