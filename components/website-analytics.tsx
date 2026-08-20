'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type VisitRow = {
  visitor_id: string | null
  session_id: string | null
  page_path: string | null
  created_at: string
}

export function WebsiteAnalytics() {
  const [visits, setVisits] = useState<VisitRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadAnalytics() {
      const supabase = createClient()

      const { data, error } = await supabase
        .from('website_visits')
        .select('visitor_id, session_id, page_path, created_at')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Website analytics error:', error)
        setError(error.message)
        setLoading(false)
        return
      }

      setVisits((data ?? []) as VisitRow[])
      setLoading(false)
    }

    loadAnalytics()
  }, [])

  const totalVisits = visits.length

  const uniqueVisitors = new Set(
    visits
      .map((visit) => visit.visitor_id)
      .filter(Boolean)
  ).size

  const today = new Date()

  const todayVisits = visits.filter((visit) => {
    const date = new Date(visit.created_at)

    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    )
  }).length

  const last7Days = new Date()
  last7Days.setDate(last7Days.getDate() - 7)

  const last7DaysVisits = visits.filter(
    (visit) => new Date(visit.created_at) >= last7Days
  ).length

  const topPages = Object.entries(
    visits.reduce<Record<string, number>>((acc, visit) => {
      const page = visit.page_path || '/'

      acc[page] = (acc[page] || 0) + 1

      return acc
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  return (
    <section className="mb-6 rounded-2xl border border-border bg-background p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold">
            Website Analytics
          </p>

          <h2 className="font-serif text-2xl font-semibold text-primary">
            Website Visitors
          </h2>
        </div>

        <p className="text-xs text-muted-foreground">
          Website visit statistics
        </p>
      </div>

      {loading ? (
        <div className="mt-5 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Loading analytics...
        </div>
      ) : error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p className="font-semibold">
            Analytics could not be loaded.
          </p>

          <p className="mt-1 break-words">
            {error}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total Visits
              </p>

              <p className="mt-2 text-2xl font-semibold text-primary">
                {totalVisits.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="rounded-xl border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Unique Visitors
              </p>

              <p className="mt-2 text-2xl font-semibold text-primary">
                {uniqueVisitors.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="rounded-xl border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Today
              </p>

              <p className="mt-2 text-2xl font-semibold text-primary">
                {todayVisits.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="rounded-xl border border-border p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Last 7 Days
              </p>

              <p className="mt-2 text-2xl font-semibold text-primary">
                {last7DaysVisits.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-border p-4">
            <div className="mb-4">
              <p className="font-medium text-primary">
                Most Visited Pages
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Top pages based on recorded visits
              </p>
            </div>

            {topPages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No website visits recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {topPages.map(([page, count]) => (
                  <div
                    key={page}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2"
                  >
                    <span className="min-w-0 truncate text-sm">
                      {page}
                    </span>

                    <span className="shrink-0 text-sm font-medium">
                      {count.toLocaleString('en-IN')} visits
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
