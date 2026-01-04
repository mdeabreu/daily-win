import React from 'react'
import { headers as getHeaders } from 'next/headers.js'
import Image from 'next/image'
import { getPayload } from 'payload'
import { fileURLToPath } from 'url'
import Tabs from '@/components/Tabs'
import LoginForm from '@/components/LoginForm'
import type { Journal, Win } from '@/payload-types'

import config from '@/payload.config'

import './styles.css'

const getDateKey = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const addDays = (date: Date, offset: number) => {
  const result = new Date(date)
  result.setDate(result.getDate() + offset)
  return result
}

const getTodayRange = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = addDays(start, 1)
  return { start, end }
}

const calculateJournalStreak = (datesWithWins: Set<string>, todayKey: string) => {
  let streak = 0
  const today = new Date(todayKey)

  for (let offset = 0; offset < 60; offset += 1) {
    const key = getDateKey(addDays(today, -offset).toISOString())
    if (!datesWithWins.has(key)) break
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
  const today = new Date(todayKey)

  winIds.forEach((winId) => {
    let count = 0
    for (let offset = 0; offset < 60; offset += 1) {
      const key = getDateKey(addDays(today, -offset).toISOString())
      const winsOnDate = winsByDate.get(key)
      if (!winsOnDate?.has(winId)) break
      count += 1
    }
    streaks[winId] = count
  })

  return streaks
}

export default async function HomePage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })
  const todayData = user
    ? await (async () => {
        const { start, end } = getTodayRange()

        const winsResponse = await payload.find({
          collection: 'wins',
          limit: 100,
          sort: 'createdAt',
          depth: 0,
          where: { active: { equals: true } },
          user,
          overrideAccess: false,
        })

        const todayResponse = await payload.find({
          collection: 'journals',
          limit: 1,
          depth: 0,
          where: {
            and: [
              { date: { greater_than_equal: start.toISOString() } },
              { date: { less_than: end.toISOString() } },
            ],
          },
          user,
          overrideAccess: false,
        })

        const recentResponse = await payload.find({
          collection: 'journals',
          limit: 60,
          depth: 0,
          sort: '-date',
          user,
          overrideAccess: false,
        })

        const todayJournal = todayResponse.docs[0] ?? null
        const winDocs = winsResponse.docs as Win[]
        const recentJournals = recentResponse.docs as Journal[]

        const completedDates = new Set<string>()
        const winsByDate = new Map<string, Set<number>>()

        recentJournals.forEach((journal) => {
          const key = getDateKey(journal.date)
          const completedWins = new Set<number>()

          completedDates.add(key)

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

        const todayKey = getDateKey(start.toISOString())
        const journalStreak = calculateJournalStreak(completedDates, todayKey)
        const winStreaks = calculateWinStreaks(
          winDocs.map((win) => win.id),
          winsByDate,
          todayKey,
        )

        return {
          todayISO: start.toISOString(),
          journal: todayJournal,
          wins: winDocs,
          journalStreak,
          winStreaks,
        }
      })()
    : null

  const fileURL = `vscode://file/${fileURLToPath(import.meta.url)}`

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Small steps. Big momentum.</p>
        <h1 className="title">Daily Wins</h1>
      </header>

      {!user && <LoginForm />}
      {user && <Tabs todayData={todayData} />}
    </div>
  )
}
