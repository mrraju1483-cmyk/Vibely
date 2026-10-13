import { useState } from 'react'
import UserSearch from '../components/UserSearch.jsx'
import UserCard from '../components/UserCard.jsx'
import PostGrid from '../components/PostGrid.jsx'
import HashtagChips from '../components/HashtagChips.jsx'
import HashtagSearchResults from '../components/HashtagSearchResults.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { useDebounced } from '../hooks/useDebounced.js'
import { popularUsersApi, recentPostsApi, recommendedUsersApi, searchPostsApi, trendingHashtagsApi, trendingPostsApi } from '../api/exploreApi.js'

const SEARCH_TABS = ['Users', 'Posts', 'Hashtags']
const FEED_TABS = ['Trending', 'Recent']

function TabBar({ tabs, value, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-2">
      {tabs.map((t) => <button key={t} role="tab" aria-selected={value === t} onClick={() => onChange(t)} className={`btn ${value === t ? 'bg-brand-600 text-white' : 'btn-ghost'}`}>{t}</button>)}
    </div>
  )
}

function Section({ title, state, isEmpty, emptyText, children }) {
  return (
    <section aria-label={title}>
      <h2 className="mb-2 font-semibold">{title}</h2>
      {state.loading && !state.data && <p role="status" className="text-sm text-slate-500">Loading...</p>}
      {state.error && <ErrorState message={state.error} onRetry={state.reload} />}
      {!state.loading && !state.error && isEmpty && <p className="text-sm text-slate-500">{emptyText}</p>}
      {!state.error && !isEmpty && children}
    </section>
  )
}

export default function ExplorePage() {
  const [q, setQ] = useState('')
  const dq = useDebounced(q.trim(), 350)
  const [searchTab, setSearchTab] = useState('Users')
  const [feedTab, setFeedTab] = useState('Trending')
  const tags = useAsync(trendingHashtagsApi, [])
  const rec = useAsync(recommendedUsersApi, [])
  const pop = useAsync(popularUsersApi, [])
  const searching = q.trim().length > 0

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="sr-only">Explore</h1>
      <input type="search" aria-label="Search users, posts and hashtags" placeholder="Search users, posts and hashtags" className="field" value={q} onChange={(e) => setQ(e.target.value)} />

      {searching ? (
        <>
          <TabBar tabs={SEARCH_TABS} value={searchTab} onChange={setSearchTab} label="Search type" />
          {searchTab === 'Users' && <UserSearch query={q} />}
          {searchTab === 'Posts' && dq && <PostGrid key={`s-${dq}`} fetchPage={(c) => searchPostsApi(dq, c)} emptyTitle="No posts found" emptyText="Try different words, or search a #hashtag." />}
          {searchTab === 'Hashtags' && <HashtagSearchResults query={dq} />}
        </>
      ) : (
        <>
          <Section title="Trending hashtags" state={tags} isEmpty={!tags.data?.hashtags.length} emptyText="No trending hashtags yet. Post with a #hashtag to start one.">
            <HashtagChips tags={tags.data?.hashtags || []} />
          </Section>

          <Section title="Recommended for you" state={rec} isEmpty={!rec.data?.users.length} emptyText="No recommendations yet. Follow a few people and like some posts to get suggestions.">
            <ul className="grid gap-x-4 sm:grid-cols-2">{rec.data?.users.map((u) => <UserCard key={u.id} user={u} />)}</ul>
          </Section>

          <section aria-label="Posts">
            <div className="mb-3"><TabBar tabs={FEED_TABS} value={feedTab} onChange={setFeedTab} label="Post lists" /></div>
            {feedTab === 'Trending'
              ? <PostGrid key="trending" fetchPage={trendingPostsApi} emptyTitle="Nothing trending yet" emptyText="Public posts from the last two weeks show up here." />
              : <PostGrid key="recent" fetchPage={recentPostsApi} emptyTitle="No recent posts" emptyText="Public posts from public accounts show up here." />}
          </section>

          <Section title="Popular people" state={pop} isEmpty={!pop.data?.users.length} emptyText="Popular accounts appear once people start following each other.">
            <ul className="grid gap-x-4 sm:grid-cols-2">{pop.data?.users.map((u) => <UserCard key={u.id} user={u} />)}</ul>
          </Section>
        </>
      )}
    </div>
  )
}
