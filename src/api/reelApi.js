import api from './axios.js'

const d = (p) => p.then((r) => r.data.data || {})
const cur = (cursor) => ({ params: { cursor: cursor || undefined } })

export const createReelApi = (formData, onProgress) =>
  d(api.post('/reels', formData, { timeout: 180000, onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total || e.loaded || 1))) }))
export const reelFeedApi = (cursor) => d(api.get('/reels/feed', cur(cursor)))
export const userReelsApi = (userId, cursor) => d(api.get(`/reels/user/${userId}`, cur(cursor)))
export const savedReelsApi = (cursor) => d(api.get('/reels/saved', cur(cursor)))
export const getReelApi = (id) => d(api.get(`/reels/${id}`)).then((x) => x.reel)
export const deleteReelApi = (id) => d(api.delete(`/reels/${id}`))
export const likeReelApi = (id) => d(api.post(`/reels/${id}/like`))
export const unlikeReelApi = (id) => d(api.delete(`/reels/${id}/like`))
export const saveReelApi = (id) => d(api.post(`/reels/${id}/save`))
export const unsaveReelApi = (id) => d(api.delete(`/reels/${id}/save`))
export const shareReelApi = (id) => d(api.post(`/reels/${id}/share`))
export const viewReelApi = (id) => d(api.post(`/reels/${id}/view`))
export const reportReelApi = (id, body) => d(api.post(`/reels/${id}/report`, body))
export const reelCommentsApi = (id, cursor) => d(api.get(`/reels/${id}/comments`, cur(cursor)))
export const addReelCommentApi = (id, text) => d(api.post(`/reels/${id}/comment`, { text }))
export const deleteReelCommentApi = (commentId) => d(api.delete(`/reels/comments/${commentId}`))
