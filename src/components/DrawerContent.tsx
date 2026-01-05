'use client'

import React from 'react'

type DrawerContentProps = {
  helper?: string
  children: React.ReactNode
  actions: React.ReactNode
}

export default function DrawerContent({ helper, children, actions }: DrawerContentProps) {
  return (
    <div className="drawer-content">
      {helper && <p className="drawer-helper">{helper}</p>}
      <div className="drawer-fields">{children}</div>
      <div className="drawer-actions">{actions}</div>
    </div>
  )
}
