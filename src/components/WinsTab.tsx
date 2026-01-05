'use client'

import React, { useMemo, useState } from 'react'
import { Archive, ArchiveRestore, Pencil } from 'lucide-react'

import type { Win } from '@/payload-types'
import Drawer from '@/components/Drawer'
import DrawerContent from '@/components/DrawerContent'

type DraftState = {
  id: number | null
  name: string
  description: string
}

const sortWins = (wins: Win[]) => {
  return [...wins].sort((a, b) => {
    if (a._order && b._order) {
      return a._order.localeCompare(b._order, undefined, { numeric: true })
    }
    return a.createdAt.localeCompare(b.createdAt)
  })
}

export default function WinsTab({
  wins,
  onRefresh,
}: {
  wins: Win[]
  onRefresh: () => Promise<void>
}) {
  const [editing, setEditing] = useState<DraftState | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [actionStatus, setActionStatus] = useState<string | null>(null)

  const activeWins = useMemo(
    () => sortWins(wins.filter((win) => win.active !== false)),
    [wins],
  )
  const archivedWins = useMemo(
    () => sortWins(wins.filter((win) => win.active === false)),
    [wins],
  )

  const openDrawer = (win?: Win) => {
    if (win) {
      setEditing({ id: win.id, name: win.name, description: win.description ?? '' })
      setDraftName(win.name)
      setDraftDescription(win.description ?? '')
    } else {
      setEditing(null)
      setDraftName('')
      setDraftDescription('')
    }
    setDrawerOpen(true)
  }

  const toggleArchive = async (win: Win, nextActive: boolean) => {
    setActionStatus(nextActive ? 'Unarchiving...' : 'Archiving...')
    try {
      const response = await fetch(`/api/wins/${win.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: nextActive }),
      })

      if (!response.ok) {
        throw new Error('Failed to update win')
      }

      await response.json()
      await onRefresh()
      setActionStatus(null)
    } catch (error) {
      console.error(error)
      setActionStatus('Update failed')
    }
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setDraftName('')
    setDraftDescription('')
    setEditing(null)
  }

  const saveWin = async () => {
    if (!draftName.trim()) return
    const isEditing = Boolean(editing?.id)
    setActionStatus(isEditing ? 'Saving win...' : 'Creating win...')

    try {
      const response = await fetch(isEditing ? `/api/wins/${editing?.id}` : '/api/wins', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draftName.trim(),
          description: draftDescription.trim() || null,
          ...(isEditing ? {} : { active: true }),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to save win')
      }

      await response.json()
      await onRefresh()
      closeDrawer()
      setActionStatus(null)
    } catch (error) {
      console.error(error)
      setActionStatus('Save failed')
    }
  }

  return (
    <>
      <h2>Wins</h2>
      <div className="wins-tab">
        <header className="wins-header">
          <div>
            <p className="wins-intro">Track your active wins and archive the ones you complete.</p>
            {actionStatus && <p className="wins-status">{actionStatus}</p>}
          </div>
          <div className="wins-actions">
            <button className="primary-button" type="button" onClick={() => openDrawer()}>
              Add win
            </button>
          </div>
        </header>

        <section className="wins-list">
          {activeWins.length === 0 && <p className="muted">No active wins yet.</p>}
          {activeWins.map((win) => {
            return (
              <article
                key={win.id}
                className="win-item"
              >
                <div className="win-body">
                  <h3>{win.name}</h3>
                  {win.description && <p>{win.description}</p>}
                </div>
                <div className="win-actions">
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Edit win"
                    onClick={() => openDrawer(win)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Archive win"
                    onClick={() => toggleArchive(win, false)}
                  >
                    <Archive size={16} />
                  </button>
                </div>
              </article>
            )
          })}
        </section>

        <details className="archived-section">
          <summary>Archived wins ({archivedWins.length})</summary>
          <div className="archived-list">
            {archivedWins.length === 0 && <p className="muted">No archived wins yet.</p>}
            {archivedWins.map((win) => (
              <article key={win.id} className="win-item archived">
                <div className="win-body">
                  <h3>{win.name}</h3>
                  {win.description && <p>{win.description}</p>}
                </div>
                <div className="win-actions">
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Unarchive win"
                    onClick={() => toggleArchive(win, true)}
                  >
                    <ArchiveRestore size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </details>
      </div>

      <Drawer title={editing ? 'Edit win' : 'Add a new win'} open={drawerOpen} onClose={closeDrawer}>
        <DrawerContent
          helper={editing ? 'Update the details for this win.' : 'Add a win you want to track.'}
          actions={
            <button className="primary-button" type="button" onClick={saveWin}>
              {editing ? 'Save changes' : 'Create win'}
            </button>
          }
        >
          <label className="drawer-label">
            Name
            <input
              className="drawer-input"
              type="text"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
            />
          </label>
          <label className="drawer-label">
            Description
            <textarea
              className="drawer-input drawer-textarea"
              rows={3}
              value={draftDescription}
              onChange={(event) => setDraftDescription(event.target.value)}
            />
          </label>
        </DrawerContent>
      </Drawer>
    </>
  )
}
