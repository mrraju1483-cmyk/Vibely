import { Router } from 'express'
import * as c from '../controllers/exploreController.js'
import { requireAuth } from '../middleware/auth.js'

const r = Router()
r.use(requireAuth)
r.get('/trending-posts', c.trendingPosts)
r.get('/recent-posts', c.recentPosts)
r.get('/popular-users', c.popularUsers)
r.get('/recommended-users', c.recommendedUsers)
r.get('/hashtags/trending', c.trendingHashtags)
r.get('/hashtags/search', c.searchHashtags)
r.get('/hashtags/:name/posts', c.hashtagPosts)
r.get('/search', c.search) // ?type=users|posts|hashtags&q=
export default r
