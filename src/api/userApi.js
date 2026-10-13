import api from './axios.js'

const d = (p) => p.then((r) => r.data.data || {})

export const getProfileApi = (id) => d(api.get(`/users/${id}`)).then((x) => x.profile)
export const updateProfileApi = (body) => d(api.put('/users/profile', body))
export const updatePrivacyApi = (isPrivate) => d(api.put('/users/privacy', { isPrivate }))
export const searchUsersApi = (q, page = 1) => d(api.get('/users/search', { params: { q, page } }))
export const followApi = (id) => d(api.post(`/users/${id}/follow`))
export const unfollowApi = (id) => d(api.delete(`/users/${id}/follow`))
export const followersApi = (id, page = 1) => d(api.get(`/users/${id}/followers`, { params: { page } }))
export const followingApi = (id, page = 1) => d(api.get(`/users/${id}/following`, { params: { page } }))
export const blockApi = (id) => d(api.post(`/users/${id}/block`))
export const unblockApi = (id) => d(api.delete(`/users/${id}/block`))
export const blockedApi = () => d(api.get('/users/blocked'))
export const requestsApi = () => d(api.get('/users/follow-requests'))
export const acceptRequestApi = (id) => d(api.post(`/users/follow-requests/${id}/accept`))
export const rejectRequestApi = (id) => d(api.delete(`/users/follow-requests/${id}`))
