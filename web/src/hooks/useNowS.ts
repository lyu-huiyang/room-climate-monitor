import { useEffect, useState } from 'react'

/** Current Unix time in seconds, refreshed every `intervalMs`. */
export function useNowS(intervalMs = 5_000): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
