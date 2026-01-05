'use client'

import React, { useCallback, useMemo, useState } from 'react'

import ProgressTab from '@/components/ProgressTab'
import TodayTab, { type TodayTabData } from '@/components/TodayTab'
import WinsTab from '@/components/WinsTab'
import type { Journal, Win } from '@/payload-types'
import { buildTodayData, getTodayRange } from '@/lib/todayData'

const tabs = [
  { id: 'today', label: 'Today' },
  { id: 'wins', label: 'Wins' },
  { id: 'progress', label: 'Progress' },
] as const

type TabId = (typeof tabs)[number]['id']

type TabsProps = {
  todayData: TodayTabData | null
  wins: Win[]
  journals: Journal[]
}

export default function Tabs({ todayData, wins, journals }: TabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('today')
  const [todayState, setTodayState] = useState<TodayTabData | null>(todayData)
  const [winsState, setWinsState] = useState<Win[]>(wins)
  const [journalsState, setJournalsState] = useState<Journal[]>(journals)

  const refreshAll = useCallback(async () => {
    const winsResponse = await fetch('/api/wins?limit=200&depth=0&sort=_order', {
      cache: 'no-store',
    })
    const journalsResponse = await fetch('/api/journals?limit=60&depth=0&sort=-date', {
      cache: 'no-store',
    })

    if (!winsResponse.ok || !journalsResponse.ok) {
      return
    }

    const winsPayload = (await winsResponse.json()) as { docs: Win[] }
    const journalsPayload = (await journalsResponse.json()) as { docs: Journal[] }
    const winsData = winsPayload.docs
    const activeWins = winsData.filter((win) => win.active !== false)
    const { start } = getTodayRange()

    setWinsState(winsData)
    setJournalsState(journalsPayload.docs)
    setTodayState(
      buildTodayData({
        todayISO: start.toISOString(),
        wins: activeWins,
        journals: journalsPayload.docs,
      }),
    )
  }, [])

  const handleJournalSaved = useCallback(
    (saved: Journal) => {
      const activeWins = winsState.filter((win) => win.active !== false)
      const { start } = getTodayRange()
      const updatedJournals = [
        saved,
        ...journalsState.filter((entry) => entry.id !== saved.id),
      ]

      setJournalsState(updatedJournals)
      setTodayState(
        buildTodayData({
          todayISO: start.toISOString(),
          wins: activeWins,
          journals: updatedJournals,
        }),
      )
    },
    [journalsState, winsState],
  )

  const panelContent = useMemo(() => {
    switch (activeTab) {
      case 'wins':
        return <WinsTab wins={winsState} onRefresh={refreshAll} />
      case 'progress':
        return <ProgressTab />
      case 'today':
      default:
        return <TodayTab data={todayState} onJournalSaved={handleJournalSaved} />
    }
  }, [activeTab, handleJournalSaved, refreshAll, todayState, winsState])

  return (
    <section className="tabs" aria-label="Daily wins sections">
      <div className="tab-list" role="tablist" aria-label="Daily wins views">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab

          return (
            <button
              key={tab.id}
              className={`tab${isActive ? ' is-active' : ''}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tab-panel-${tab.id}`}
              id={`tab-${tab.id}`}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="tab-panels">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab

          return (
            <section
              key={tab.id}
              className={`tab-panel${isActive ? ' is-active' : ''}`}
              role="tabpanel"
              id={`tab-panel-${tab.id}`}
              aria-labelledby={`tab-${tab.id}`}
              aria-hidden={!isActive}
            >
              {isActive ? panelContent : null}
            </section>
          )
        })}
      </div>
    </section>
  )
}
