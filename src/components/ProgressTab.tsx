'use client'

import React, { useEffect, useMemo, useState } from 'react'

import type { Journal } from '@/payload-types'
import { buildDayKey, getDateKey } from '@/lib/date'
import { buildDateRangeWhere } from '@/lib/api'
import { useJournals } from '@/hooks/useJournals'

const monthLabels = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

type ProgressTabProps = {
  journals: Journal[]
  onDaySelect?: (dateKey: string) => void
}

type LayoutMode = 'month' | 'week'

const buildYearRange = (year: number) => {
  const start = new Date(year, 0, 1)
  const end = new Date(year + 1, 0, 1)
  return { start, end }
}

const getJournalKey = (journal: Journal) => {
  return getDateKey(journal.date)
}

export default function ProgressTab({ journals, onDaySelect }: ProgressTabProps) {
  const {
    journals: yearJournals,
    setJournals: setYearJournals,
    status: loadState,
    refresh: refreshJournals,
  } = useJournals({ initialJournals: journals })
  const currentYear = useMemo(() => new Date().getFullYear(), [])
  const todayKey = useMemo(() => getDateKey(new Date()), [])
  const [year, setYear] = useState(currentYear)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('month')

  useEffect(() => {
    if (journals.length === 0) return
    setYearJournals((current) => {
      const merged = new Map<number, Journal>()
      current.forEach((entry) => merged.set(entry.id, entry))
      journals.forEach((entry) => merged.set(entry.id, entry))
      return Array.from(merged.values())
    })
  }, [journals, setYearJournals])

  useEffect(() => {
    const loadYear = async () => {
      try {
        const { start, end } = buildYearRange(year)
        await refreshJournals({
          limit: 366,
          depth: 0,
          sort: 'date',
          where: buildDateRangeWhere(start, end),
        })
      } catch (error) {
        console.error(error)
      }
    }

    void loadYear()
  }, [refreshJournals, year])

  const journalsByDate = useMemo(() => {
    const map = new Map<string, Journal>()
    yearJournals.forEach((journal) => {
      const key = getJournalKey(journal)
      if (!key) return
      if (!map.has(key)) {
        map.set(key, journal)
      }
    })
    return map
  }, [yearJournals])

  const weekGridDays = useMemo(() => {
    const start = new Date(year, 0, 1)
    const end = new Date(year + 1, 0, 1)
    const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000)
    const offset = start.getDay()

    return Array.from({ length: offset + totalDays }, (_, index) => {
      if (index < offset) return null
      const dayIndex = index - offset + 1
      return new Date(year, 0, dayIndex)
    })
  }, [year])

  return (
    <>
      <h2>Progress</h2>
      <p className="placeholder">See how your year is shaping up at a glance.</p>

      <section className="progress-card">
        <div className="progress-header">
          <div>
            <p className="progress-eyebrow">Year overview</p>
            <div className="progress-year-row" aria-label="Year navigation">
              <button
                className="date-arrow"
                type="button"
                aria-label="Previous year"
                onClick={() => setYear((value) => value - 1)}
              >
                ←
              </button>
              <h3 className="progress-title">{year}</h3>
              <button
                className="date-arrow"
                type="button"
                aria-label="Next year"
                onClick={() => setYear((value) => Math.min(currentYear, value + 1))}
                disabled={year >= currentYear}
              >
                →
              </button>
            </div>
          </div>
          <div className="progress-legend" aria-label="Day rating legend">
            <div className="legend-item">
              <span className="legend-dot is-missing" />
              <span>Missing</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot is-unrated" />
              <span>No rating</span>
            </div>
            <div className="legend-item">
              {[1, 2, 3, 4, 5].map((value) => (
                <span key={value} className={`legend-dot rating-${value}`} />
              ))}
              <span>1-5</span>
            </div>
          </div>
        </div>

        <div className="progress-actions">
          <div className="progress-toggle" role="group" aria-label="Year layout">
            <button
              className={`toggle-button${layoutMode === 'month' ? ' is-active' : ''}`}
              type="button"
              onClick={() => setLayoutMode('month')}
            >
              Months
            </button>
            <button
              className={`toggle-button${layoutMode === 'week' ? ' is-active' : ''}`}
              type="button"
              onClick={() => setLayoutMode('week')}
            >
              Weeks
            </button>
          </div>
        </div>

        {layoutMode === 'month' ? (
          <div className="year-grid">
            {monthLabels.map((label, monthIndex) => {
              const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
              const days = Array.from({ length: daysInMonth }, (_, dayIndex) => {
                const day = dayIndex + 1
                const key = buildDayKey(year, monthIndex, day)
                const journal = journalsByDate.get(key)
                const rating = journal?.rating ?? null

                let stateClass = 'is-missing'
                if (journal && rating) {
                  stateClass = `rating-${rating}`
                } else if (journal) {
                  stateClass = 'is-unrated'
                }

                const labelText = journal
                  ? rating
                    ? `${label} ${day}: ${rating}/5`
                    : `${label} ${day}: journal, no rating`
                  : `${label} ${day}: no entry`
                const canSelect = Boolean(onDaySelect && key <= todayKey)

                return (
                  <button
                    key={key}
                    className={`day-dot ${stateClass}`}
                    title={labelText}
                    aria-label={labelText}
                    type="button"
                    onClick={() => onDaySelect?.(key)}
                    disabled={!canSelect}
                  />
                )
              })

              return (
                <div key={label} className="month-row">
                  <div className="month-label">{label}</div>
                  <div className="month-days">{days}</div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="week-grid">
            {weekGridDays.map((date, index) => {
              if (!date) {
                return <span key={`empty-${index}`} className="day-dot is-empty" aria-hidden />
              }

              const monthIndex = date.getMonth()
              const day = date.getDate()
              const label = monthLabels[monthIndex]
              const key = buildDayKey(year, monthIndex, day)
              const journal = journalsByDate.get(key)
              const rating = journal?.rating ?? null

              let stateClass = 'is-missing'
              if (journal && rating) {
                stateClass = `rating-${rating}`
              } else if (journal) {
                stateClass = 'is-unrated'
              }

              const labelText = journal
                ? rating
                  ? `${label} ${day}: ${rating}/5`
                  : `${label} ${day}: journal, no rating`
                : `${label} ${day}: no entry`
              const canSelect = Boolean(onDaySelect && key <= todayKey)

              return (
                <button
                  key={key}
                  className={`day-dot ${stateClass}`}
                  title={labelText}
                  aria-label={labelText}
                  type="button"
                  onClick={() => onDaySelect?.(key)}
                  disabled={!canSelect}
                />
              )
            })}
          </div>
        )}

        {loadState === 'loading' && <p className="muted">Updating year view...</p>}
        {loadState === 'error' && (
          <p className="muted">We could not load the full year. Showing recent entries.</p>
        )}
      </section>
    </>
  )
}
