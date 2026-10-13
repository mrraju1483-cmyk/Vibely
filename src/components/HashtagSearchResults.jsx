import HashtagChips from './HashtagChips.jsx'
import EmptyState from './EmptyState.jsx'
import ErrorState from './ErrorState.jsx'
import { useAsync } from '../hooks/useAsync.js'
import { searchHashtagsApi } from '../api/exploreApi.js'

export default function HashtagSearchResults({ query }) {
  const { data, loading, error, reload } = useAsync(() => (query ? searchHashtagsApi(query) : Promise.resolve({ hashtags: [] })), [query])
  if (!query) return null
  if (error) return <ErrorState message={error} onRetry={reload} />
  if (loading && !data) return <p role="status" className="py-3 text-center text-sm text-slate-500">Searching...</p>
  if (!data.hashtags.length) return <EmptyState icon="#️⃣" title="No hashtags found" text={`Nothing matched "${query}".`} />
  return <HashtagChips tags={data.hashtags} />
}
