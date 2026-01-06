'use client'

import React, { useEffect, useId, useRef } from 'react'

type DrawerProps = {
  title: string
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}

export default function Drawer({ title, open, onClose, children, className }: DrawerProps) {
  const titleId = useId()
  const drawerRef = useRef<HTMLElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const drawerClassName = ['note-drawer', open ? 'is-open' : '', className ?? '']
    .filter(Boolean)
    .join(' ')

  useEffect(() => {
    if (!open) return

    previousFocusRef.current = document.activeElement as HTMLElement | null

    const focusFirst = () => {
      const root = drawerRef.current
      if (!root) return
      const focusable = root.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
      )
      const target = focusable[0] ?? root
      target.focus()
    }

    const raf = window.requestAnimationFrame(focusFirst)

    return () => {
      window.cancelAnimationFrame(raf)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      previousFocusRef.current?.focus?.()
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }

      if (event.key !== 'Tab') return
      const root = drawerRef.current
      if (!root) return
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) {
        event.preventDefault()
        root.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  useEffect(() => {
    if (!open) return
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
    }
  }, [open])

  return (
    <>
      <div
        className={`drawer-backdrop${open ? ' is-open' : ''}`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        ref={drawerRef}
        className={drawerClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="note-drawer-header">
          <h4 id={titleId}>{title}</h4>
          <button className="note-close" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </aside>
    </>
  )
}
