import React from 'react'
import { headers as getHeaders } from 'next/headers.js'
import Image from 'next/image'
import { getPayload } from 'payload'
import Tabs from '@/components/Tabs'
import LoginForm from '@/components/LoginForm'
import type { Journal, Win } from '@/payload-types'
import { getTodayRange } from '@/lib/date'
import { buildTodayData } from '@/lib/todayData'

import config from '@/payload.config'

import './styles.css'

export default async function HomePage() {
  const headers = await getHeaders()
  const payloadConfig = await config
  const payload = await getPayload({ config: payloadConfig })
  const { user } = await payload.auth({ headers })
  const initialJournals = user
    ? await (async () => {
        const { start } = getTodayRange()

        const winsResponse = await payload.find({
          collection: 'wins',
          limit: 200,
          sort: '_order',
          depth: 0,
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

        const winDocs = winsResponse.docs as Win[]
        const activeWins = winDocs.filter((win) => win.active !== false)
        const recentJournals = recentResponse.docs as Journal[]
        return { activeWins, recentJournals, todayISO: start.toISOString() }
      })()
    : null
  const winsAll = user
    ? await (async () => {
        const winsResponse = await payload.find({
          collection: 'wins',
          limit: 200,
          sort: '_order',
          depth: 0,
          user,
          overrideAccess: false,
        })
        return winsResponse.docs as Win[]
      })()
    : []
  const todayData = initialJournals
    ? buildTodayData({
        todayISO: initialJournals.todayISO,
        wins: initialJournals.activeWins,
        journals: initialJournals.recentJournals,
      })
    : null

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Small steps. Big momentum.</p>
        <h1 className="title">Daily Wins</h1>
      </header>

      {!user && <LoginForm />}
      {user && (
        <Tabs todayData={todayData} wins={winsAll} journals={initialJournals?.recentJournals ?? []} />
      )}
    </div>
  )
}
