import { useEffect, useState } from 'react'

export function useDebounced(value, delay = 350) {
  const [v, setV] = useState(value)
  useEffect(() => { const id = setTimeout(() => setV(value), delay); return () => clearTimeout(id) }, [value, delay])
  return v
}
