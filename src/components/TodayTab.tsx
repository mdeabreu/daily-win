/* eslint-disable @typescript-eslint/no-misused-promises */
'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'

import type { Journal, Win } from '@/payload-types'
import Drawer from '@/components/Drawer'
import DrawerContent from '@/components/DrawerContent'
import { addDaysToKey, getDateKey, getDateRange } from '@/lib/date'
import { useJournalDay } from '@/hooks/useJournalDay'

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
type SaveContext = {
  dateKey: string
  journalId: number | null
  rating: number | null
  journalText: string
  winsState: WinEntryState[]
}

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

const buildPayload = ({ dateKey, rating, journalText, winsState }: SaveContext) => {
  const winsPayload = winsState
    .filter((entry) => entry.completed)
    .map((entry) => ({
      win: entry.winId,
      completed: entry.completed,
      note: entry.note.trim() || undefined,
    }))

  const { start } = getDateRange(dateKey)
  return {
    date: start.toISOString(),
    rating: rating ?? undefined,
    journal: journalText.trim() || undefined,
    wins: winsPayload,
  }
}

export default function TodayTab({
  data,
  onJournalSaved,
  selectedDateKey: requestedDateKey,
  onDateChange,
}: {
  data: TodayTabData | null
  onJournalSaved?: (journal: Journal) => void
  selectedDateKey?: string
  onDateChange?: (dateKey: string) => void
}) {
  const [activeNoteWinId, setActiveNoteWinId] = useState<number | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const { status: dateStatus, load: loadJournalDay } = useJournalDay()
  const [supportsPicker, setSupportsPicker] = useState(true)
  const [isTouch, setIsTouch] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(data?.journal?.updatedAt ?? null)
  const dateInputRef = useRef<HTMLInputElement | null>(null)

  const [journalId, setJournalId] = useState<number | null>(data?.journal?.id ?? null)
  const [rating, setRating] = useState<number | null>(data?.journal?.rating ?? null)
  const [journalText, setJournalText] = useState<string>(data?.journal?.journal ?? '')
  const [winsState, setWinsState] = useState<WinEntryState[]>(() =>
    data ? buildWinsState(data.wins, data.journal) : [],
  )
  const todayKey = data?.todayISO ? getDateKey(data.todayISO) : ''
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey)
  const selectedDateKeyRef = useRef(selectedDateKey)
  const saveTimerRef = useRef<number | null>(null)
  const saveInFlightRef = useRef(false)
  const [initialSnapshot, setInitialSnapshot] = useState<string>(() =>
    buildSnapshot(
      data?.journal?.rating ?? null,
      data?.journal?.journal ?? '',
      data ? buildWinsState(data.wins, data.journal) : [],
    ),
  )

  useEffect(() => {
    setHasMounted(true)
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

  useEffect(() => {
    selectedDateKeyRef.current = selectedDateKey
  }, [selectedDateKey])

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

  const lastSavedLabel = useMemo(() => {
    if (!hasMounted) return null
    if (!lastSavedAt) return null
    const savedDate = new Date(lastSavedAt)
    if (Number.isNaN(savedDate.getTime())) return null
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(savedDate)
  }, [hasMounted, lastSavedAt])

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
    applyJournal(data.journal ?? null, { keepNoteOpen: Boolean(activeNoteWinId) })
  }, [activeNoteWinId, data?.journal, isDirty, lastSavedAt, selectedDateKey, todayKey])

  useEffect(() => {
    if (!data) return
    if (!isDirty) return
    if (!canSave) return
    if (saveInFlightRef.current) return

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
    }

    const context: SaveContext = {
      dateKey: selectedDateKey,
      journalId,
      rating,
      journalText,
      winsState,
    }

    saveTimerRef.current = window.setTimeout(() => {
      void saveSnapshot(context)
    }, 900)

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [canSave, data, isDirty, journalId, journalText, rating, selectedDateKey, winsState])

  useEffect(() => {
    if (!requestedDateKey) return
    if (requestedDateKey === selectedDateKey) return
    void requestDateChange(requestedDateKey, { notifyParent: false })
  }, [requestedDateKey, selectedDateKey])

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

  const applyJournal = (journal: Journal | null, options?: { keepNoteOpen?: boolean }) => {
    setJournalId(journal?.id ?? null)
    setRating(journal?.rating ?? null)
    setJournalText(journal?.journal ?? '')
    setWinsState(data ? buildWinsState(data.wins, journal) : [])
    if (!options?.keepNoteOpen) {
      setActiveNoteWinId(null)
    }
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

  const saveSnapshot = async (context: SaveContext): Promise<boolean> => {
    if (!data) return false
    if (saveInFlightRef.current) return false

    saveInFlightRef.current = true
    const isCurrentDate = () => context.dateKey === selectedDateKeyRef.current
    if (isCurrentDate()) {
      setSaveStatus('saving')
    }
    const payload = buildPayload(context)

    try {
      const endpoint = context.journalId ? `/api/journals/${context.journalId}` : '/api/journals'
      const response = await fetch(endpoint, {
        method: context.journalId ? 'PATCH' : 'POST',
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
        rating: saved.rating ?? context.rating ?? null,
        journal: saved.journal ?? context.journalText ?? null,
        wins: saved.wins ?? payload.wins,
      }

      if (isCurrentDate()) {
        applyJournal(merged, { keepNoteOpen: true })
        setJournalId(merged.id)
        setLastSavedAt(merged.updatedAt ?? new Date().toISOString())
        setSaveStatus('saved')
        window.setTimeout(() => setSaveStatus('idle'), 2500)
      }
      if (onJournalSaved) {
        onJournalSaved(saved)
      }
      return true
    } catch (error) {
      console.error(error)
      if (isCurrentDate()) {
        setSaveStatus('error')
      }
      return false
    } finally {
      saveInFlightRef.current = false
    }
  }

  const handleSave = async (): Promise<boolean> => {
    return saveSnapshot({
      dateKey: selectedDateKey,
      journalId,
      rating,
      journalText,
      winsState,
    })
  }

  const requestDateChange = async (
    nextKey: string,
    { notifyParent = true }: { notifyParent?: boolean } = {},
  ) => {
    if (nextKey === selectedDateKey) return
    if (nextKey > todayKey) return

    setActiveNoteWinId(null)

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    if (isDirty && canSave) {
      void saveSnapshot({
        dateKey: selectedDateKey,
        journalId,
        rating,
        journalText,
        winsState,
      })
    }

    const previousKey = selectedDateKey
    setSelectedDateKey(nextKey)
    if (notifyParent) {
      onDateChange?.(nextKey)
    }
    const loaded = await loadJournalDay(nextKey)
      .then((journal) => {
        applyJournal(journal)
        return true
      })
      .catch((error) => {
        console.error(error)
        return false
      })
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
          <button
            className="primary-button"
            type="button"
            onClick={handleSave}
            disabled={!canSave || saveStatus === 'saving'}
          >
            Save now
          </button>
          <span className={`save-status status-${saveStatus}`} suppressHydrationWarning>
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'saved' && 'Saved'}
            {saveStatus === 'error' && 'Could not save'}
            {saveStatus === 'idle' && lastSavedLabel ? `Last saved at ${lastSavedLabel}` : ''}
            {saveStatus === 'saved' && lastSavedLabel ? ` · ${lastSavedLabel}` : ''}
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
