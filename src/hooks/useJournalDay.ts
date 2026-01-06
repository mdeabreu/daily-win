import { useCallback, useEffect, useRef, useState } from 'react'

import type { Journal } from '@/payload-types'
import { fetchJournalByDate } from '@/lib/api'

type LoadStatus = 'idle' | 'loading' | 'error'

export const useJournalDay = () => {
  const [status, setStatus] = useState<LoadStatus>('idle')
  const [error, setError] = useState<Error | null>(null)
  const isMounted = useRef(true)

  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [])

  const load = useCallback(async (dateKey: string) => {
    setStatus('loading')
    setError(null)
    try {
      const journal = await fetchJournalByDate(dateKey)
      if (isMounted.current) {
        setStatus('idle')
      }
      return journal as Journal | null
    } catch (err) {
      if (isMounted.current) {
        setStatus('error')
        setError(err as Error)
      }
      throw err
    }
  }, [])

  return { status, error, load }
}
