import { useCallback, useEffect, useRef, useState } from 'react'

import type { Journal } from '@/payload-types'
import { fetchJournals, type FetchJournalsArgs } from '@/lib/api'

type LoadStatus = 'idle' | 'loading' | 'error'

type UseJournalsOptions = {
  initialJournals?: Journal[]
  params?: FetchJournalsArgs
}

export const useJournals = ({ initialJournals = [], params }: UseJournalsOptions = {}) => {
  const [journals, setJournals] = useState<Journal[]>(initialJournals)
  const [status, setStatus] = useState<LoadStatus>('idle')
  const [error, setError] = useState<Error | null>(null)
  const isMounted = useRef(true)

  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  const refresh = useCallback(
    async (override?: FetchJournalsArgs) => {
      setStatus('loading')
      setError(null)
      try {
        const docs = await fetchJournals(override ?? params)
        if (isMounted.current) {
          setJournals(docs)
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

  return { journals, setJournals, status, error, refresh }
}
