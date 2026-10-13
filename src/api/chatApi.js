import api from './axios.js'

const d = (p) => p.then((r) => r.data.data || {})

export const listConversationsApi = () => d(api.get('/chat/conversations'))
export const getConversationApi = (id) => d(api.get(`/chat/conversations/${id}`))
export const openDirectApi = (userId) => d(api.post('/chat/conversations/direct', { userId }))
export const createGroupApi = (name, memberIds) => d(api.post('/chat/conversations/group', { name, memberIds }))
export const renameGroupApi = (id, name) => d(api.put(`/chat/conversations/${id}`, { name }))
export const setGroupPhotoApi = (id, file) => { const fd = new FormData(); fd.append('media', file); return d(api.put(`/chat/conversations/${id}/photo`, fd)) }
export const setDisappearApi = (id, disappearAfter) => d(api.put(`/chat/conversations/${id}/settings`, { disappearAfter }))
export const addMembersApi = (id, userIds) => d(api.post(`/chat/conversations/${id}/members`, { userIds }))
export const removeMemberApi = (id, userId) => d(api.delete(`/chat/conversations/${id}/members/${userId}`))
export const messagesApi = (id, cursor) => d(api.get(`/chat/conversations/${id}/messages`, { params: { cursor: cursor || undefined } }))
export const markReadApi = (id) => d(api.post(`/chat/conversations/${id}/read`))
export const deleteMessageApi = (id, messageId, scope) => d(api.delete(`/chat/conversations/${id}/messages/${messageId}`, { params: { scope } }))
export const updateChatPrivacyApi = (body) => d(api.put('/users/chat-privacy', body))
export function sendMessageApi(id, { text, file }, onProgress) {
  if (!file) return d(api.post(`/chat/conversations/${id}/messages`, { text }))
  const fd = new FormData()
  fd.append('media', file)
  if (text) fd.append('text', text)
  return d(api.post(`/chat/conversations/${id}/messages`, fd, { timeout: 180000, onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / (e.total || e.loaded || 1))) }))
}
