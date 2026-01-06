import type { Journal, Win } from '@/payload-types'
import { addDays, addDaysToKey, getDateFromKey, getDateKey } from '@/lib/date'

export type TodayDataInput = {
  todayISO: string
  wins: Win[]
  journals: Journal[]
}

const getStreakStartKey = (todayKey: string, hasEntryToday: boolean) => {
  if (hasEntryToday) return todayKey
  return addDaysToKey(todayKey, -1)
}

const calculateJournalStreak = (completedDates: Set<string>, startKey: string) => {
  let streak = 0
  const startDate = getDateFromKey(startKey)

  for (let offset = 0; offset < 60; offset += 1) {
    const key = getDateKey(addDays(startDate, -offset))
    if (!completedDates.has(key)) break
    streak += 1
  }

  return streak
}

const calculateWinStreaks = (
  winIds: number[],
  winsByDate: Map<string, Set<number>>,
  todayKey: string,
) => {
  const streaks: Record<number, number> = {}

  winIds.forEach((winId) => {
    const hasToday = winsByDate.get(todayKey)?.has(winId) ?? false
    const startKey = getStreakStartKey(todayKey, hasToday)
    const startDate = getDateFromKey(startKey)
    let count = 0
    for (let offset = 0; offset < 60; offset += 1) {
      const key = getDateKey(addDays(startDate, -offset))
      const winsOnDate = winsByDate.get(key)
      if (!winsOnDate?.has(winId)) break
      count += 1
    }
    streaks[winId] = count
  })

  return streaks
}

export const buildTodayData = ({ todayISO, wins, journals }: TodayDataInput) => {
  const todayKey = getDateKey(todayISO)
  const completedDates = new Set<string>()
  const winsByDate = new Map<string, Set<number>>()

  journals.forEach((journal) => {
    const key = getDateKey(journal.date)
    completedDates.add(key)

    const completedWins = new Set<number>()
    journal.wins?.forEach((entry) => {
      if (!entry?.completed) return
      const winId = typeof entry.win === 'number' ? entry.win : entry.win?.id
      if (!winId) return
      completedWins.add(winId)
    })

    if (completedWins.size > 0) {
      winsByDate.set(key, completedWins)
    }
  })

  const hasToday = completedDates.has(todayKey)
  const streakStartKey = getStreakStartKey(todayKey, hasToday)
  const journalStreak = calculateJournalStreak(completedDates, streakStartKey)
  const winStreaks = calculateWinStreaks(
    wins.map((win) => win.id),
    winsByDate,
    todayKey,
  )

  const journal =
    journals.find((entry) => {
      return getDateKey(entry.date) === todayKey
    }) ?? null

  return {
    todayISO,
    journal,
    wins,
    journalStreak,
    winStreaks,
  }
}
