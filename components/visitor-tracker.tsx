'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export function VisitorTracker() {
  useEffect(() => {
    const trackVisitor = async () => {
      try {
        let visitorId = localStorage.getItem('leela_visitor_id')

        if (!visitorId) {
          visitorId =
            crypto.randomUUID()

          localStorage.setItem(
            'leela_visitor_id',
            visitorId
          )
        }

        let sessionId =
          sessionStorage.getItem(
            'leela_session_id'
          )

        if (!sessionId) {
          sessionId =
            crypto.randomUUID()

          sessionStorage.setItem(
            'leela_session_id',
            sessionId
          )
        }

        const supabase =
          createClient()

        await supabase
          .from('website_visits')
          .insert({
            visitor_id: visitorId,
            session_id: sessionId,
            page_path:
              window.location.pathname,
          })
      } catch {
        // Visitor tracking should never
        // affect the customer website.
      }
    }

    trackVisitor()
  }, [])

  return null
}
