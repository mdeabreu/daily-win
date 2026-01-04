/* eslint-disable @typescript-eslint/no-misused-promises */
'use client'

import React, { useMemo, useState } from 'react'

import type { Journal, Win } from '@/payload-types'

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

export default function TodayTab({ data }: { data: TodayTabData | null }) {
  const [activeNoteWinId, setActiveNoteWinId] = useState<number | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  const [journalId, setJournalId] = useState<number | null>(data?.journal?.id ?? null)
  const [rating, setRating] = useState<number | null>(data?.journal?.rating ?? null)
  const [journalText, setJournalText] = useState<string>(data?.journal?.journal ?? '')
  const [winsState, setWinsState] = useState<WinEntryState[]>(() => {
    if (!data) return []

    return data.wins.map((win) => {
      const journalEntry = data.journal?.wins?.find((entry) => getWinId(entry.win) === win.id)

      return {
        winId: win.id,
        completed: Boolean(journalEntry?.completed),
        note: journalEntry?.note ?? '',
      }
    })
  })

  const todayLabel = useMemo(() => {
    if (!data?.todayISO) return 'Today'
    const formatter = new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
    return formatter.format(new Date(data.todayISO))
  }, [data?.todayISO])

  const completedWinsCount = useMemo(
    () => winsState.filter((entry) => entry.completed).length,
    [winsState],
  )

  const canSave = useMemo(() => {
    if (!data) return false
    return Boolean(rating || journalText.trim() || winsState.some((entry) => entry.completed))
  }, [data, journalText, rating, winsState])

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

  const handleSave = async () => {
    if (!data) return

    setSaveStatus('saving')

    const winsPayload = winsState
      .filter((entry) => entry.completed)
      .map((entry) => ({
        win: entry.winId,
        completed: entry.completed,
        note: entry.note.trim() || undefined,
      }))

    const payload = {
      date: data.todayISO,
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

      const saved = (await response.json()) as Journal
      setJournalId(saved.id)
      setSaveStatus('saved')
      window.setTimeout(() => setSaveStatus('idle'), 2500)
    } catch (error) {
      console.error(error)
      setSaveStatus('error')
    }
  }

  if (!data) {
    return <LoggedOutToday />
  }

  const activeNoteWin = winsState.find((entry) => entry.winId === activeNoteWinId)
  const activeWinDetails = data.wins.find((win) => win.id === activeNoteWinId)

  return (
    <>
      <h2>Today</h2>
      <div className="today-tab">
        <header className="today-header">
          <div>
            <p className="today-date">{todayLabel}</p>
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

      <aside className={`note-drawer${activeNoteWinId ? ' is-open' : ''}`} role="dialog">
        <div className="note-drawer-header">
          <h4>{activeWinDetails?.name ?? 'Win note'}</h4>
          <button className="note-close" type="button" onClick={closeNoteDrawer}>
            Close
          </button>
        </div>
        <p className="note-helper">Add a quick note for today&apos;s win.</p>
        <textarea
          className="note-textarea"
          rows={5}
          placeholder="A little detail about what made this a win..."
          value={activeNoteWin?.note ?? ''}
          onChange={(event) =>
            activeNoteWinId && updateWinState(activeNoteWinId, { note: event.target.value })
          }
        />
        <button className="primary-button" type="button" onClick={closeNoteDrawer}>
          Done
        </button>
      </aside>
    </>
  )
}
