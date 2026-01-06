'use client'

import React, { useCallback, useMemo, useState } from 'react'

import ProgressTab from '@/components/ProgressTab'
import TodayTab, { type TodayTabData } from '@/components/TodayTab'
import WinsTab from '@/components/WinsTab'
import type { Journal, Win } from '@/payload-types'
import { getDateKey, getTodayRange } from '@/lib/date'
import { buildTodayData } from '@/lib/todayData'
import { useJournals } from '@/hooks/useJournals'
import { useWins } from '@/hooks/useWins'

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
  const [selectedDateKey, setSelectedDateKey] = useState<string>(
    todayData?.todayISO ? getDateKey(todayData.todayISO) : '',
  )
  const winsParams = useMemo(() => ({ limit: 200, depth: 0, sort: '_order' }), [])
  const journalsParams = useMemo(() => ({ limit: 60, depth: 0, sort: '-date' }), [])
  const { wins: winsState, refresh: refreshWins } = useWins({
    initialWins: wins,
    params: winsParams,
  })
  const {
    journals: journalsState,
    setJournals: setJournalsState,
    refresh: refreshJournals,
  } = useJournals({ initialJournals: journals, params: journalsParams })

  const refreshAll = useCallback(async () => {
    try {
      const [winsData, journalDocs] = await Promise.all([refreshWins(), refreshJournals()])
      const activeWins = winsData.filter((win) => win.active !== false)
      const { start } = getTodayRange()

      setTodayState(
        buildTodayData({
          todayISO: start.toISOString(),
          wins: activeWins,
          journals: journalDocs,
        }),
      )
    } catch (error) {
      console.error(error)
    }
  }, [refreshJournals, refreshWins])

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
        return (
          <ProgressTab
            journals={journalsState}
            onDaySelect={(dateKey) => {
              setSelectedDateKey(dateKey)
              setActiveTab('today')
            }}
          />
        )
      case 'today':
      default:
        return (
          <TodayTab
            data={todayState}
            onJournalSaved={handleJournalSaved}
            selectedDateKey={selectedDateKey}
            onDateChange={setSelectedDateKey}
          />
        )
    }
  }, [activeTab, handleJournalSaved, journalsState, refreshAll, selectedDateKey, todayState, winsState])

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
