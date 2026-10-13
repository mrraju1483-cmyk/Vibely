import api from './axios.js'

const d = (p) => p.then((r) => r.data.data || {})

export const adminStatsApi = () => d(api.get('/admin/stats'))
export const adminUsersApi = (params) => d(api.get('/admin/users', { params }))
export const adminUserApi = (id) => d(api.get(`/admin/users/${id}`))
export const adminSetUserActiveApi = (id, active, reason) => d(api.put(`/admin/users/${id}/status`, { active, reason }))
export const adminRemoveUserApi = (id, reason) => d(api.post(`/admin/users/${id}/remove`, { reason }))
export const adminListApi = (kind, params) => d(api.get(`/admin/${kind}`, { params })) // kind: posts | reels | comments
export const adminRemoveContentApi = (kind, id, reason, commentKind) =>
  d(api.post(`/admin/${kind}/${id}/remove`, { reason, ...(commentKind && { kind: commentKind }) }))
export const adminReportsApi = (params) => d(api.get('/admin/reports', { params }))
export const adminUpdateReportApi = (id, body) => d(api.put(`/admin/reports/${id}`, body))
export const adminAuditApi = (params) => d(api.get('/admin/audit', { params }))
