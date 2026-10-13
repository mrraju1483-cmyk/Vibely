import { useEffect, useState } from 'react'
import { getAIStatus } from '../api/aiApi.js'

// status is null while loading, then { available, reason? }
export function useAIStatus() {
  const [status, setStatus] = useState(null)
  useEffect(() => {
    let alive = true
    getAIStatus().then((s) => { if (alive) setStatus(s) })
    return () => { alive = false }
  }, [])
  return status
}
