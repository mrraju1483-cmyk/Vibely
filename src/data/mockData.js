// Mock data kept separate from UI. Replace with API calls in later phases.
export const users = [
  { id: 1, name: 'Riya Sharma', username: 'riya.s', online: true },
  { id: 2, name: 'Arjun Patel', username: 'arjun_p', online: true },
  { id: 3, name: 'Sneha Kapoor', username: 'sneha.k', online: false },
  { id: 4, name: 'Karthik Rao', username: 'karthik', online: false },
  { id: 5, name: 'Neha Verma', username: 'neha.v', online: true },
]
export const currentUser = { id: 0, name: 'Raju', username: 'raju', bio: 'Share your vibe. Code, learn, teach. ✨', posts: 24, followers: 1280, following: 312 }

export const stories = users.map((u) => ({ id: u.id, name: u.name.split(' ')[0], seen: u.id % 3 === 0 }))

export const posts = [
  { id: 1, user: users[0], time: '2h', caption: 'Good vibes only ✨', likes: 1243, comments: 58, shares: 12, hue: 270 },
  { id: 2, user: users[1], time: '4h', caption: 'Sunday coding session ☕ #buildinpublic', likes: 864, comments: 31, shares: 7, hue: 320 },
  { id: 3, user: users[2], time: '6h', caption: 'Sunset by the beach 🌅', likes: 2310, comments: 112, shares: 40, hue: 20 },
  { id: 4, user: users[3], time: '1d', caption: 'New playlist on repeat 🎧', likes: 540, comments: 19, shares: 3, hue: 200 },
]

export const conversations = [
  { id: 1, name: 'Riya Sharma', last: 'See you tomorrow!', time: '10:42', online: true },
  { id: 2, name: 'Arjun Patel', last: 'Send me the notes', time: '09:15', online: true },
  { id: 3, name: 'Sneha Kapoor', last: 'Loved your post 😍', time: 'Yesterday', online: false },
  { id: 4, name: 'Best Friends Group', last: 'Neha: Movie tonight?', time: 'Yesterday', online: false },
  { id: 5, name: 'Family', last: 'Mom: Dinner at 8', time: 'Mon', online: false },
]
export const messages = [
  { id: 1, mine: false, text: 'Hey! How is the project going?', time: '10:38' },
  { id: 2, mine: true, text: 'Great, Phase 1 UI is done 🎉', time: '10:40' },
  { id: 3, mine: false, text: 'See you tomorrow!', time: '10:42' },
]

export const notifications = [
  { id: 1, text: 'Riya Sharma liked your post', time: '5m' },
  { id: 2, text: 'Arjun Patel started following you', time: '1h' },
  { id: 3, text: 'Sneha Kapoor commented: "Love this!"', time: '3h' },
]

export const trendingTopics = [
  { tag: '#Travel', posts: '12.4K' }, { tag: '#Food', posts: '9.8K' }, { tag: '#Music', posts: '8.1K' },
  { tag: '#Fitness', posts: '6.7K' }, { tag: '#Gaming', posts: '5.2K' }, { tag: '#Fashion', posts: '4.9K' },
]
