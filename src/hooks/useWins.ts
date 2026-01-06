import { useCallback, useEffect, useRef, useState } from 'react'

import type { Win } from '@/payload-types'
import { fetchWins, type FetchWinsArgs } from '@/lib/api'

type LoadStatus = 'idle' | 'loading' | 'error'

type UseWinsOptions = {
  initialWins?: Win[]
  params?: FetchWinsArgs
}

export const useWins = ({ initialWins = [], params }: UseWinsOptions = {}) => {
  const [wins, setWins] = useState<Win[]>(initialWins)
  const [status, setStatus] = useState<LoadStatus>('idle')
  const [error, setError] = useState<Error | null>(null)
  const isMounted = useRef(true)

  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  const refresh = useCallback(
    async (override?: FetchWinsArgs) => {
      setStatus('loading')
      setError(null)
      try {
        const docs = await fetchWins(override ?? params)
        if (isMounted.current) {
          setWins(docs)
          setStatus('idle')
        }
        return docs
      } catch (err) {
        if (isMounted.current) {
          setStatus('error')
          setError(err as Error)
        }
        throw err
      }
    },
    [params],
  )

  return { wins, setWins, status, error, refresh }
}
