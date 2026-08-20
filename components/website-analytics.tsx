'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Visit = {
  visitor_id: string
  page_path: string | null
  created_at: string
}

type AnalyticsData = {
  totalVisits: number
  uniqueVisitors: number
  todayVisits: number
  last7Days: number
  thisMonth: number
  topPages: {
    page: string
    visits: number
  }[]
}

const emptyAnalytics: AnalyticsData = {
  totalVisits: 0,
  uniqueVisitors: 0,
  todayVisits: 0,
  last7Days: 0,
  thisMonth: 0,
  topPages: [],
}

export function WebsiteAnalytics() {
  const supabase = createClient()

  const [data, setData] =
    useState<AnalyticsData>(emptyAnalytics)

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  async function loadAnalytics() {
    setLoading(true)
    setError('')

    try {
      const { data: visits, error } = await supabase
        .from('website_visits')
        .select('visitor_id, page_path, created_at')
        .order('created_at', {
          ascending: false,
        })

      if (error) {
        throw error
      }

      const rows = (visits ?? []) as Visit[]

      const now = new Date()

      const startOfToday = new Date(now)
      startOfToday.setHours(0, 0, 0, 0)

      const sevenDaysAgo = new Date(now)
      sevenDaysAgo.setDate(
        sevenDaysAgo.getDate() - 7
      )

      const startOfMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      )

      const uniqueVisitors = new Set(
        rows
          .map((row) => row.visitor_id)
          .filter(Boolean)
      ).size

      const todayVisits = rows.filter((row) => {
        return (
          new Date(row.created_at) >=
          startOfToday
        )
      }).length

      const last7Days = rows.filter((row) => {
        return (
          new Date(row.created_at) >=
          sevenDaysAgo
        )
      }).length

      const thisMonth = rows.filter((row) => {
        return (
          new Date(row.created_at) >=
          startOfMonth
        )
      }).length

      const pageCounts: Record<string, number> = {}

      for (const row of rows) {
        const page = row.page_path || '/'

        pageCounts[page] =
          (pageCounts[page] ?? 0) + 1
      }

      const topPages = Object.entries(
        pageCounts
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([page, visits]) => ({
          page,
          visits,
        }))

      setData({
        totalVisits: rows.length,
        uniqueVisitors,
        todayVisits,
        last7Days,
        thisMonth,
        topPages,
      })
    } catch (error: any) {
      setError(
        error?.message ||
          'Unable to load website analytics.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnalytics()
  }, [])

  return (
    <section className="mb-6 rounded-2xl border border-border bg-background p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold">
            Website Analytics
          </p>

          <h2 className="font-serif text-2xl font-semibold text-primary">
            Visitor Overview
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Track visits and visitors to your jewellery website.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAnalytics}
          disabled={loading}
          className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition hover:bg-secondary disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">
            Analytics Load Failed
          </p>

          <p className="mt-1">
            {error}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-border bg-secondary/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Unique Visitors
              </p>

              <p className="mt-2 text-2xl font-semibold text-primary">
                {loading ? '—' : data.uniqueVisitors}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-secondary/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total Visits
              </p>

              <p className="mt-2 text-2xl font-semibold text-primary">
                {loading ? '—' : data.totalVisits}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-secondary/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Today
              </p>

              <p className="mt-2 text-2xl font-semibold text-primary">
                {loading ? '—' : data.todayVisits}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-secondary/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Last 7 Days
              </p>

              <p className="mt-2 text-2xl font-semibold text-primary">
                {loading ? '—' : data.last7Days}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-secondary/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                This Month
              </p>

              <p className="mt-2 text-2xl font-semibold text-primary">
                {loading ? '—' : data.thisMonth}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-border bg-secondary/20 p-4">
            <h3 className="font-serif text-lg font-semibold text-primary">
              Most Visited Pages
            </h3>

            {loading ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Loading analytics…
              </p>
            ) : data.topPages.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No visits recorded yet.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {data.topPages.map((item) => (
                  <div
                    key={item.page}
                    className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2"
                  >
                    <span className="truncate text-sm">
                      {item.page}
                    </span>

                    <span className="ml-4 text-sm font-medium text-primary">
                      {item.visits} visits
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
