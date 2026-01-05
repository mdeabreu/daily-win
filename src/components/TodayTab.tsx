/* eslint-disable @typescript-eslint/no-misused-promises */
'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'

import type { Journal, Win } from '@/payload-types'
import Drawer from '@/components/Drawer'
import DrawerContent from '@/components/DrawerContent'

export type TodayTabData = {
  todayISO: string
  journal: Journal | null
  wins: Win[]
  journalStreak: number
  winStreaks: Record<number, number>
}

type WinEntryState = {
  winId: number
  completed: boolean
  note: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function LoggedOutToday() {
  return (
    <>
      <h2>Today</h2>
      <p className="placeholder">Sign in to capture today&apos;s progress.</p>
    </>
  )
}

const getWinId = (entry: NonNullable<Journal['wins']>[number]['win']) => {
  if (!entry) return null
  return typeof entry === 'number' ? entry : entry.id
}

const buildWinsState = (wins: Win[], journal: Journal | null): WinEntryState[] => {
  return wins.map((win) => {
    const journalEntry = journal?.wins?.find((entry) => getWinId(entry.win) === win.id)

    return {
      winId: win.id,
      completed: Boolean(journalEntry?.completed),
      note: journalEntry?.note ?? '',
    }
  })
}

const buildSnapshot = (rating: number | null, journalText: string, winsState: WinEntryState[]) => {
  return JSON.stringify({
    rating,
    journalText: journalText.trim(),
    wins: winsState.map((entry) => ({
      winId: entry.winId,
      completed: entry.completed,
      note: entry.note.trim(),
    })),
  })
}

const getDateKey = (date: Date) => date.toISOString().slice(0, 10)

const addDays = (date: Date, offset: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + offset)
  return next
}

const addDaysToKey = (dateKey: string, offset: number) => {
  const date = new Date(`${dateKey}T00:00:00`)
  return getDateKey(addDays(date, offset))
}

const getDateRange = (dateKey: string) => {
  const start = new Date(`${dateKey}T00:00:00`)
  const end = addDays(start, 1)
  return { start, end }
}

export default function TodayTab({
  data,
  onJournalSaved,
}: {
  data: TodayTabData | null
  onJournalSaved?: (journal: Journal) => void
}) {
  const [activeNoteWinId, setActiveNoteWinId] = useState<number | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [dateStatus, setDateStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [supportsPicker, setSupportsPicker] = useState(true)
  const [isTouch, setIsTouch] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(data?.journal?.updatedAt ?? null)
  const dateInputRef = useRef<HTMLInputElement | null>(null)

  const [journalId, setJournalId] = useState<number | null>(data?.journal?.id ?? null)
  const [rating, setRating] = useState<number | null>(data?.journal?.rating ?? null)
  const [journalText, setJournalText] = useState<string>(data?.journal?.journal ?? '')
  const [winsState, setWinsState] = useState<WinEntryState[]>(() =>
    data ? buildWinsState(data.wins, data.journal) : [],
  )
  const todayKey = data?.todayISO ? data.todayISO.slice(0, 10) : ''
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey)
  const [initialSnapshot, setInitialSnapshot] = useState<string>(() =>
    buildSnapshot(
      data?.journal?.rating ?? null,
      data?.journal?.journal ?? '',
      data ? buildWinsState(data.wins, data.journal) : [],
    ),
  )

  useEffect(() => {
    const hasPicker =
      typeof window !== 'undefined' &&
      typeof HTMLInputElement !== 'undefined' &&
      'showPicker' in HTMLInputElement.prototype
    setSupportsPicker(hasPicker)
    setIsTouch(
      typeof window !== 'undefined' &&
        ('ontouchstart' in window || (navigator?.maxTouchPoints ?? 0) > 0),
    )
  }, [])

  const todayLabel = useMemo(() => {
    if (!selectedDateKey) return 'Today'
    const formatter = new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
    const displayDate = new Date(`${selectedDateKey}T12:00:00`)
    const isToday = selectedDateKey === todayKey
    return isToday ? `Today · ${formatter.format(displayDate)}` : formatter.format(displayDate)
  }, [selectedDateKey, todayKey])

  const completedWinsCount = useMemo(
    () => winsState.filter((entry) => entry.completed).length,
    [winsState],
  )

  const currentSnapshot = useMemo(
    () => buildSnapshot(rating, journalText, winsState),
    [journalText, rating, winsState],
  )
  const isDirty = currentSnapshot !== initialSnapshot

  const canSave = useMemo(() => {
    if (!data) return false
    return Boolean(rating || journalText.trim() || winsState.some((entry) => entry.completed))
  }, [data, journalText, rating, winsState])

  useEffect(() => {
    if (!data) return
    setWinsState((prev) => {
      const previousMap = new Map(prev.map((entry) => [entry.winId, entry]))
      const next = data.wins.map((win) => {
        const existing = previousMap.get(win.id)
        if (existing) return existing
        return { winId: win.id, completed: false, note: '' }
      })
      if (!isDirty) {
        setInitialSnapshot(buildSnapshot(rating, journalText, next))
      }
      return next
    })
  }, [data?.wins, isDirty, journalText, rating])

  useEffect(() => {
    if (!data) return
    if (selectedDateKey !== todayKey) return
    if (isDirty) return
    if (data.journal?.updatedAt && lastSavedAt && data.journal.updatedAt < lastSavedAt) {
      return
    }
    applyJournal(data.journal ?? null)
  }, [data?.journal, isDirty, lastSavedAt, selectedDateKey, todayKey])

  const openNoteDrawer = (winId: number) => {
    setActiveNoteWinId(winId)
  }

  const closeNoteDrawer = () => {
    setActiveNoteWinId(null)
  }

  const updateWinState = (winId: number, updates: Partial<WinEntryState>) => {
    setWinsState((prev) =>
      prev.map((entry) => (entry.winId === winId ? { ...entry, ...updates } : entry)),
    )
  }

  const applyJournal = (journal: Journal | null) => {
    setJournalId(journal?.id ?? null)
    setRating(journal?.rating ?? null)
    setJournalText(journal?.journal ?? '')
    setWinsState(data ? buildWinsState(data.wins, journal) : [])
    setActiveNoteWinId(null)
    setSaveStatus('idle')
    setLastSavedAt(journal?.updatedAt ?? null)
    setInitialSnapshot(
      buildSnapshot(
        journal?.rating ?? null,
        journal?.journal ?? '',
        data ? buildWinsState(data.wins, journal) : [],
      ),
    )
  }

  const handleSave = async (): Promise<boolean> => {
    if (!data) return false

    setSaveStatus('saving')

    const winsPayload = winsState
      .filter((entry) => entry.completed)
      .map((entry) => ({
        win: entry.winId,
        completed: entry.completed,
        note: entry.note.trim() || undefined,
      }))

    const { start } = getDateRange(selectedDateKey)
    const payload = {
      date: start.toISOString(),
      rating: rating ?? undefined,
      journal: journalText.trim() || undefined,
      wins: winsPayload,
    }

    try {
      const endpoint = journalId ? `/api/journals/${journalId}` : '/api/journals'
      const response = await fetch(endpoint, {
        method: journalId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Failed to save journal: ${response.status}`)
      }

      const result = (await response.json()) as Journal | { doc: Journal }
      const saved = 'doc' in result ? result.doc : result
      const merged: Journal = {
        ...saved,
        date: saved.date ?? payload.date,
        rating: saved.rating ?? rating ?? null,
        journal: saved.journal ?? journalText ?? null,
        wins: saved.wins ?? winsPayload,
      }
      applyJournal(merged)
      setJournalId(merged.id)
      setSaveStatus('saved')
      window.setTimeout(() => setSaveStatus('idle'), 2500)
      if (onJournalSaved) {
        onJournalSaved(saved)
      }
      return true
    } catch (error) {
      console.error(error)
      setSaveStatus('error')
      return false
    }
  }

  const loadJournalForDate = async (dateKey: string) => {
    if (!data) return false
    setDateStatus('loading')

    try {
      const { start, end } = getDateRange(dateKey)
      const params = new URLSearchParams()
      params.set('limit', '1')
      params.set('depth', '0')
      params.set('where[and][0][date][greater_than_equal]', start.toISOString())
      params.set('where[and][1][date][less_than]', end.toISOString())

      const response = await fetch(`/api/journals?${params.toString()}`, {
        method: 'GET',
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(`Failed to load journal: ${response.status}`)
      }

      const result = (await response.json()) as { docs: Journal[] }
      const journal = result.docs[0] ?? null

      applyJournal(journal)
      setDateStatus('idle')
      return true
    } catch (error) {
      console.error(error)
      setDateStatus('error')
      return false
    }
  }

  const confirmSaveIfDirty = async () => {
    if (!isDirty) return true
    const shouldSave = window.confirm('You have unsaved changes. Save before leaving this day?')
    if (!shouldSave) return false
    return handleSave()
  }

  const requestDateChange = async (nextKey: string) => {
    if (nextKey === selectedDateKey) return
    if (nextKey > todayKey) return

    const canLeave = await confirmSaveIfDirty()
    if (!canLeave) return

    const previousKey = selectedDateKey
    setSelectedDateKey(nextKey)
    const loaded = await loadJournalForDate(nextKey)
    if (loaded) {
      return
    }
    setSelectedDateKey(previousKey)
  }

  if (!data) {
    return <LoggedOutToday />
  }

  const activeNoteWin = winsState.find((entry) => entry.winId === activeNoteWinId)
  const activeWinDetails = data.wins.find((win) => win.id === activeNoteWinId)
  const isToday = selectedDateKey === todayKey

  return (
    <>
      <h2>Today</h2>
      <div className="today-tab">
        <header className="today-header">
          <div>
            <div className="date-nav">
              <button
                className="date-arrow"
                type="button"
                aria-label="Previous day"
                onClick={() => requestDateChange(addDaysToKey(selectedDateKey, -1))}
                disabled={dateStatus === 'loading'}
              >
                ←
              </button>
              <div className="date-picker">
                {supportsPicker && !isTouch ? (
                  <>
                    <button
                      className="date-picker-button"
                      type="button"
                      onClick={() => {
                        dateInputRef.current?.showPicker?.()
                        dateInputRef.current?.focus()
                      }}
                      disabled={dateStatus === 'loading'}
                    >
                      <span className="today-date">{todayLabel}</span>
                    </button>
                    <input
                      ref={dateInputRef}
                      className="date-picker-input"
                      type="date"
                      value={selectedDateKey}
                      max={todayKey}
                      onChange={(event) => requestDateChange(event.target.value)}
                      aria-label="Pick a date"
                      disabled={dateStatus === 'loading'}
                      tabIndex={-1}
                    />
                  </>
                ) : supportsPicker && isTouch ? (
                  <>
                    <span className="today-date">{todayLabel}</span>
                    <input
                      className="date-picker-touch"
                      type="date"
                      value={selectedDateKey}
                      max={todayKey}
                      onChange={(event) => requestDateChange(event.target.value)}
                      aria-label="Pick a date"
                      disabled={dateStatus === 'loading'}
                    />
                  </>
                ) : (
                  <label className="date-picker-fallback">
                    <span className="today-date">{todayLabel}</span>
                    <input
                      className="date-input"
                      type="date"
                      value={selectedDateKey}
                      max={todayKey}
                      onChange={(event) => requestDateChange(event.target.value)}
                      aria-label="Pick a date"
                      disabled={dateStatus === 'loading'}
                    />
                  </label>
                )}
              </div>
              <button
                className="date-arrow"
                type="button"
                aria-label="Next day"
                onClick={() => requestDateChange(addDaysToKey(selectedDateKey, 1))}
                disabled={isToday || dateStatus === 'loading'}
              >
                →
              </button>
            </div>
            <p className="today-intro">Close the day with a quick check-in.</p>
          </div>
          <span className="streak-pill">Journal streak: {data.journalStreak} days</span>
        </header>

        <div className="today-grid">
          <section className="today-card rating-card">
            <div className="card-header">
              <h3>Day rating</h3>
              <span className="card-meta">1-5</span>
            </div>
            <div className="rating-group" role="radiogroup" aria-label="Day rating">
              {[1, 2, 3, 4, 5].map((value) => {
                const isSelected = rating === value

                return (
                  <button
                    key={value}
                    className={`rating-button${isSelected ? ' is-selected' : ''}`}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setRating(value)}
                  >
                    {value}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="today-card wins-card">
            <div className="card-header">
              <h3>Wins for today</h3>
              <span className="card-meta">
                {completedWinsCount} of {data.wins.length} checked
              </span>
            </div>
            <div className="wins-list">
              {data.wins.length === 0 && <p className="muted">No active wins yet.</p>}
              {data.wins.map((win) => {
                const entry = winsState.find((item) => item.winId === win.id)
                const streak = data.winStreaks[win.id] ?? 0

                return (
                  <div key={win.id} className="win-row">
                    <label className="win-check">
                      <input
                        type="checkbox"
                        checked={entry?.completed ?? false}
                        onChange={(event) => {
                          updateWinState(win.id, { completed: event.target.checked })
                        }}
                      />
                      <span>
                        {win.name}
                        {win.description && <small>{win.description}</small>}
                      </span>
                    </label>
                    <div className="win-meta">
                      <span className="streak-chip">{streak} day streak</span>
                      <button
                        className={`note-button${entry?.note ? ' has-note' : ''}`}
                        type="button"
                        onClick={() => openNoteDrawer(win.id)}
                      >
                        {entry?.note ? 'Edit note' : 'Add note'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="today-card journal-card">
            <div className="card-header">
              <h3>Journal</h3>
              <span className="card-meta">What stood out?</span>
            </div>
            <textarea
              className="journal-textarea"
              rows={6}
              placeholder="Capture the moments, lessons, or gratitude from today."
              value={journalText}
              onChange={(event) => setJournalText(event.target.value)}
            />
          </section>
        </div>

        <div className="today-actions">
          <button className="primary-button" type="button" onClick={handleSave} disabled={!canSave}>
            {journalId ? 'Save updates' : 'Save today'}
          </button>
          <span className={`save-status status-${saveStatus}`}>
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'saved' && 'Saved'}
            {saveStatus === 'error' && 'Could not save'}
          </span>
        </div>
      </div>

      <Drawer
        title={activeWinDetails?.name ?? 'Win note'}
        open={Boolean(activeNoteWinId)}
        onClose={closeNoteDrawer}
      >
        <DrawerContent
          helper="Add a quick note for today's win."
          actions={
            <button className="primary-button" type="button" onClick={closeNoteDrawer}>
              Done
            </button>
          }
        >
          <textarea
            className="note-textarea"
            rows={5}
            placeholder="A little detail about what made this a win..."
            value={activeNoteWin?.note ?? ''}
            onChange={(event) =>
              activeNoteWinId && updateWinState(activeNoteWinId, { note: event.target.value })
            }
          />
        </DrawerContent>
      </Drawer>
    </>
  )
}
