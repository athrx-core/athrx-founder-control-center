'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'

type FailureBreakdownItem = {
  type: string
  count: number
}

type DashboardData = {
  ok?: boolean
  generated_at?: string
  queue: {
    total: number
    queued: number
    processing: number
    completed: number
    dead_letter: number
  }
  retry: {
    ready_now: number
    max_attempts: number
    schedule: number[]
    last_run: string | null
  }
  failure: {
    total_failed: number
    dead_letter: number
    breakdown: FailureBreakdownItem[]
  }
  healing: {
    last_run: string | null
    processed: number
  }
}

const EMPTY_DASHBOARD: DashboardData = {
  queue: {
    total: 0,
    queued: 0,
    processing: 0,
    completed: 0,
    dead_letter: 0
  },
  retry: {
    ready_now: 0,
    max_attempts: 0,
    schedule: [],
    last_run: null
  },
  failure: {
    total_failed: 0,
    dead_letter: 0,
    breakdown: []
  },
  healing: {
    last_run: null,
    processed: 0
  }
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function asBreakdown(value: unknown): FailureBreakdownItem[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const record = item as Record<string, unknown>
    return {
      type: typeof record?.type === 'string' ? record.type : 'unknown',
      count: asNumber(record?.count)
    }
  })
}

function normalizeDashboard(payload: unknown): DashboardData {
  const root = (payload ?? {}) as Record<string, unknown>
  const queue = (root.queue ?? {}) as Record<string, unknown>
  const retry = (root.retry ?? {}) as Record<string, unknown>
  const failure = (root.failure ?? {}) as Record<string, unknown>
  const healing = (root.healing ?? {}) as Record<string, unknown>

  return {
    ok: typeof root.ok === 'boolean' ? root.ok : true,
    generated_at: asStringOrNull(root.generated_at) ?? undefined,
    queue: {
      total: asNumber(queue.total),
      queued: asNumber(queue.queued),
      processing: asNumber(queue.processing),
      completed: asNumber(queue.completed),
      dead_letter: asNumber(queue.dead_letter)
    },
    retry: {
      ready_now: asNumber(retry.ready_now),
      max_attempts: asNumber(retry.max_attempts),
      schedule: Array.isArray(retry.schedule)
        ? retry.schedule.map((item) => asNumber(item))
        : [],
      last_run: asStringOrNull(retry.last_run)
    },
    failure: {
      total_failed: asNumber(failure.total_failed),
      dead_letter: asNumber(failure.dead_letter),
      breakdown: asBreakdown(failure.breakdown)
    },
    healing: {
      last_run: asStringOrNull(healing.last_run),
      processed: asNumber(healing.processed)
    }
  }
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'N/A'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString()
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD)
  const [loading, setLoading] = useState(true)
  const [runningAction, setRunningAction] = useState<'retry' | 'healing' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const scheduleText = useMemo(() => {
    return data.retry.schedule.length > 0 ? data.retry.schedule.join(', ') : 'N/A'
  }, [data.retry.schedule])

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`/api/dashboard?refresh=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!res.ok) {
        throw new Error(`dashboard_fetch_failed_${res.status}`)
      }

      const json = (await res.json()) as unknown
      const normalized = normalizeDashboard(json)

      setData(normalized)
      setError(null)
    } catch (err) {
      console.error('Dashboard fetch failed:', err)
      setData(EMPTY_DASHBOARD)
      setError('System temporarily unavailable')
    } finally {
      setLoading(false)
    }
  }

  const runAction = async (
    endpoint: '/api/cron/retry-cycle' | '/api/cron/self-healing',
    action: 'retry' | 'healing'
  ) => {
    try {
      setRunningAction(action)
      setError(null)

      const res = await fetch(`${endpoint}?refresh=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store'
      })

      if (!res.ok) {
        throw new Error(`action_failed_${action}_${res.status}`)
      }

      await fetchDashboard()
    } catch (err) {
      console.error(`Dashboard action failed (${action}):`, err)
      setError(`Failed to run ${action === 'retry' ? 'Retry Cycle' : 'Self-Healing'}`)
    } finally {
      setRunningAction(null)
    }
  }

  useEffect(() => {
    void fetchDashboard()

    const interval = window.setInterval(() => {
      void fetchDashboard()
    }, 10000)

    return () => window.clearInterval(interval)
  }, [])

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                ATHRX Founder Control Center
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Production dashboard for queue, retry, failure, and self-healing control.
              </p>
            </div>

            <div className="text-sm text-slate-500">
              Last Refresh: {formatTimestamp(data.generated_at ?? null)}
            </div>
          </div>
        </header>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-600">Loading system...</p>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard title="Total" value={data.queue.total} />
          <MetricCard title="Queued" value={data.queue.queued} />
          <MetricCard title="Processing" value={data.queue.processing} />
          <MetricCard title="Completed" value={data.queue.completed} />
          <MetricCard title="Dead Letter" value={data.queue.dead_letter} />
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Panel title="Retry System">
            <KeyValue label="Ready Now" value={String(data.retry.ready_now)} />
            <KeyValue label="Max Attempts" value={String(data.retry.max_attempts)} />
            <KeyValue label="Schedule" value={scheduleText} />
            <KeyValue label="Last Run" value={formatTimestamp(data.retry.last_run)} />
          </Panel>

          <Panel title="Failure Intelligence">
            <KeyValue label="Total Failed" value={String(data.failure.total_failed)} />
            <KeyValue label="Dead Letter" value={String(data.failure.dead_letter)} />

            <div className="mt-4">
              <div className="mb-2 text-sm font-medium text-slate-700">Breakdown</div>

              {data.failure.breakdown.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  No failures
                </div>
              ) : (
                <div className="space-y-2">
                  {data.failure.breakdown.map((item, index) => (
                    <div
                      key={`${item.type}-${index}`}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <span className="text-sm text-slate-700">{item.type}</span>
                      <span className="text-sm font-semibold text-slate-900">{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Self-Healing Engine">
            <KeyValue label="Processed" value={String(data.healing.processed)} />
            <KeyValue label="Last Run" value={formatTimestamp(data.healing.last_run)} />

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void runAction('/api/cron/retry-cycle', 'retry')}
                disabled={runningAction !== null}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {runningAction === 'retry' ? 'Running Retry Cycle...' : 'Run Retry Cycle'}
              </button>

              <button
                type="button"
                onClick={() => void runAction('/api/cron/self-healing', 'healing')}
                disabled={runningAction !== null}
                className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {runningAction === 'healing' ? 'Running Self-Healing...' : 'Run Self-Healing'}
              </button>
            </div>
          </Panel>
        </section>
      </div>
    </main>
  )
}

function MetricCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{title}</div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  )
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  )
}