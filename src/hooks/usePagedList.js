import { useCallback, useEffect, useRef, useState } from 'react'
import { getErrorMessage } from '../api/axios.js'

export function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value)
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id) }, [value, ms])
  return v
}

// fetcher(cursor) -> { list, nextCursor }. Reloads from the first page whenever `deps` change.
// Stale answers (from an older filter) are ignored.
export function usePagedList(fetcher, deps) {
  const [items, setItems] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const fetchRef = useRef(fetcher)
  fetchRef.current = fetcher
  const cursorRef = useRef(null)
  const seq = useRef(0)

  const load = useCallback(async (reset) => {
    const mine = ++seq.current
    setLoading(true); setError('')
    try {
      const d = await fetchRef.current(reset ? null : cursorRef.current)
      if (mine !== seq.current) return
      cursorRef.current = d.nextCursor
      setHasMore(!!d.nextCursor)
      setItems((prev) => (reset ? d.list : [...prev, ...d.list]))
    } catch (e) {
      if (mine === seq.current) setError(getErrorMessage(e))
    } finally {
      if (mine === seq.current) setLoading(false)
    }
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(true) }, deps)

  return { items, setItems, hasMore, loading, error, reload: () => load(true), more: () => load(false) }
}
