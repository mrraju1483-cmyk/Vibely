import api from './axios.js'

const d = (p) => p.then((r) => r.data.data || {})

export const notificationsApi = (cursor) => d(api.get('/notifications', { params: { cursor: cursor || undefined } }))
export const markNotificationReadApi = (id) => d(api.put(`/notifications/${id}/read`))
export const markAllNotificationsReadApi = () => d(api.put('/notifications/read-all'))
