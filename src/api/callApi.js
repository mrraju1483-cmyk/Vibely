import api from './axios.js'

const d = (p) => p.then((r) => r.data.data || {})

export const callConfigApi = () => d(api.get('/calls/config'))
export const callHistoryApi = (cursor) => d(api.get('/calls', { params: { cursor: cursor || undefined } }))
