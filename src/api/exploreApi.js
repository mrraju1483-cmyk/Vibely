import api from './axios.js'

const d = (p) => p.then((r) => r.data.data || {})

// Trending and search use page numbers; PostGrid just passes the cursor back, so we map nextPage <-> cursor here
const paged = (x) => ({ posts: x.posts, nextCursor: x.nextPage ? String(x.nextPage) : null })

export const trendingPostsApi = (cursor) => d(api.get('/explore/trending-posts', { params: { page: cursor || 1 } })).then(paged)
export const recentPostsApi = (cursor) => d(api.get('/explore/recent-posts', { params: { cursor: cursor || undefined } }))
export const popularUsersApi = () => d(api.get('/explore/popular-users'))
export const recommendedUsersApi = () => d(api.get('/explore/recommended-users'))
export const trendingHashtagsApi = () => d(api.get('/explore/hashtags/trending'))
export const searchHashtagsApi = (q) => d(api.get('/explore/hashtags/search', { params: { q } }))
export const hashtagPostsApi = (name, cursor) => d(api.get(`/explore/hashtags/${encodeURIComponent(name)}/posts`, { params: { cursor: cursor || undefined } }))
export const searchPostsApi = (q, cursor) => d(api.get('/explore/search', { params: { type: 'posts', q, page: cursor || 1 } })).then(paged)
