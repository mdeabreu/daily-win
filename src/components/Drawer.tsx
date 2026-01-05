'use client'

import React from 'react'

type DrawerProps = {
  title: string
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}

export default function Drawer({ title, open, onClose, children, className }: DrawerProps) {
  const drawerClassName = ['note-drawer', open ? 'is-open' : '', className ?? '']
    .filter(Boolean)
    .join(' ')

  return (
    <aside className={drawerClassName} role="dialog" aria-modal="true">
      <div className="note-drawer-header">
        <h4>{title}</h4>
        <button className="note-close" type="button" onClick={onClose}>
          Close
        </button>
      </div>
      {children}
    </aside>
  )
}
