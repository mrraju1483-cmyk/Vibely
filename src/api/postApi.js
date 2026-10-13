import api from './axios.js'

const d = (p) => p.then((r) => r.data.data || {})

export const createPostApi = (formData, onProgress) =>
  d(api.post('/posts', formData, { timeout: 120000, onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total || e.loaded || 1))) }))
export const feedApi = (cursor) => d(api.get('/posts/feed', { params: { cursor: cursor || undefined } }))
export const userPostsApi = (userId, cursor) => d(api.get(`/posts/user/${userId}`, { params: { cursor: cursor || undefined } }))
export const savedPostsApi = (cursor) => d(api.get('/posts/saved', { params: { cursor: cursor || undefined } }))
export const getPostApi = (id) => d(api.get(`/posts/${id}`)).then((x) => x.post)
export const deletePostApi = (id) => d(api.delete(`/posts/${id}`))
export const likePostApi = (id) => d(api.post(`/posts/${id}/like`))
export const unlikePostApi = (id) => d(api.delete(`/posts/${id}/like`))
export const savePostApi = (id) => d(api.post(`/posts/${id}/save`))
export const unsavePostApi = (id) => d(api.delete(`/posts/${id}/save`))
export const sharePostApi = (id) => d(api.post(`/posts/${id}/share`))
export const reportPostApi = (id, body) => d(api.post(`/posts/${id}/report`, body))
export const reportUserApi = (id, body) => d(api.post(`/users/${id}/report`, body))
export const commentsApi = (postId, cursor) => d(api.get(`/posts/${postId}/comments`, { params: { cursor: cursor || undefined } }))
export const addCommentApi = (postId, body) => d(api.post(`/posts/${postId}/comment`, body))
export const repliesApi = (commentId, cursor) => d(api.get(`/comments/${commentId}/replies`, { params: { cursor: cursor || undefined } }))
export const likeCommentApi = (id) => d(api.post(`/comments/${id}/like`))
export const unlikeCommentApi = (id) => d(api.delete(`/comments/${id}/like`))
export const deleteCommentApi = (id) => d(api.delete(`/comments/${id}`))
