'use client'

import { useEffect, useState } from 'react'

type DashboardData = {
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
    breakdown: { type: string; count: number }[]
  }
  healing: {
    last_run: string | null
    processed: number
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/dashboard?refresh=1', {
        cache: 'no-store'
      })

      if (!res.ok) throw new Error()

      const json = await res.json()
      setData(json)
      setError(null)
    } catch {
      setError('System temporarily unavailable')
    } finally {
      setLoading(false)
    }
  }

  const runRetry = async () => {
    await fetch('/api/cron/retry-cycle')
    fetchDashboard()
  }

  const runHealing = async () => {
    await fetch('/api/cron/self-healing')
    fetchDashboard()
  }

  useEffect(() => {
    fetchDashboard()
    const interval = setInterval(fetchDashboard, 10000)
    return () => clearInterval(interval)
  }, [])

  if (loading) return <div className="p-6">Loading system...</div>

  if (error)
    return <div className="p-6 text-red-500">{error}</div>

  if (!data) return null

  return (
    <div className="p-6 space-y-6">

      {/* QUEUE */}
      <div className="grid grid-cols-5 gap-4">
        <Card title="Total" value={data.queue.total} />
        <Card title="Queued" value={data.queue.queued} />
        <Card title="Processing" value={data.queue.processing} />
        <Card title="Completed" value={data.queue.completed} />
        <Card title="Dead Letter" value={data.queue.dead_letter} />
      </div>

      {/* RETRY */}
      <Section title="Retry System">
        <p>Ready Now: {data.retry.ready_now}</p>
        <p>Max Attempts: {data.retry.max_attempts}</p>
        <p>Schedule: {data.retry.schedule.join(', ') || 'N/A'}</p>
      </Section>

      {/* FAILURE */}
      <Section title="Failure Intelligence">
        {data.failure.breakdown.length === 0 ? (
          <p>No failures</p>
        ) : (
          data.failure.breakdown.map((f, i) => (
            <p key={i}>
              {f.type}: {f.count}
            </p>
          ))
        )}
      </Section>

      {/* HEALING */}
      <Section title="Self-Healing Engine">
        <p>Processed: {data.healing.processed}</p>
        <p>Last Run: {data.healing.last_run || 'N/A'}</p>
      </Section>

      {/* ACTIONS */}
      <div className="flex gap-4">
        <button
          onClick={runRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Run Retry Cycle
        </button>

        <button
          onClick={runHealing}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          Run Self-Healing
        </button>
      </div>

    </div>
  )
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="p-4 border rounded-xl">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="p-4 border rounded-xl">
      <h2 className="font-semibold mb-2">{title}</h2>
      {children}
    </div>
  )
}