import { useCallback, useEffect, useState } from 'react'
import { getErrorMessage } from '../api/axios.js'

// Runs an async function on mount / when deps change. Gives { data, loading, error, reload }.
export function useAsync(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }))
    try { setState({ data: await fn(), loading: false, error: '' }) } catch (e) { setState({ data: null, loading: false, error: getErrorMessage(e) }) }
  }, deps)
  useEffect(() => { run() }, [run])
  return { ...state, reload: run }
}
