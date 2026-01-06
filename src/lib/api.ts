import type { Journal, Win } from '@/payload-types'
import { getDateRange } from '@/lib/date'

type FetchListResponse<T> = {
  docs: T[]
}

type QueryValue = string | number | undefined

export type FetchWinsArgs = {
  limit?: number
  depth?: number
  sort?: string
}

export type FetchJournalsArgs = {
  limit?: number
  depth?: number
  sort?: string
  where?: Record<string, QueryValue>
}

const buildParams = (params: Record<string, QueryValue>) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined) return
    search.set(key, String(value))
  })
  return search
}

const buildUrl = (path: string, params: URLSearchParams) => {
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

export const buildDateRangeWhere = (start: Date, end: Date) => {
  return {
    'where[and][0][date][greater_than_equal]': start.toISOString(),
    'where[and][1][date][less_than]': end.toISOString(),
  }
}

export const fetchWins = async ({ limit, depth, sort }: FetchWinsArgs = {}) => {
  const params = buildParams({ limit, depth, sort })
  const response = await fetch(buildUrl('/api/wins', params), { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Failed to fetch wins: ${response.status}`)
  }

  const payload = (await response.json()) as FetchListResponse<Win>
  return payload.docs
}

export const fetchJournals = async ({
  limit,
  depth,
  sort,
  where,
}: FetchJournalsArgs = {}) => {
  const params = buildParams({ limit, depth, sort, ...(where ?? {}) })
  const response = await fetch(buildUrl('/api/journals', params), { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Failed to fetch journals: ${response.status}`)
  }

  const payload = (await response.json()) as FetchListResponse<Journal>
  return payload.docs
}

export const fetchJournalByDate = async (dateKey: string) => {
  const { start, end } = getDateRange(dateKey)
  const where = buildDateRangeWhere(start, end)
  const docs = await fetchJournals({ limit: 1, depth: 0, where })
  return docs[0] ?? null
}
