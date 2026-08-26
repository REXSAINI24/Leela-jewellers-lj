'use client'

import { useEffect } from 'react'

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.register('/admin-sw.js', { scope: '/admin' }).catch(() => {
      // PWA support is optional; the dashboard continues to work normally if registration fails.
    })
  }, [])

  return null
}
