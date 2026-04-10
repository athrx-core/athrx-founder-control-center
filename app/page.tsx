'use client'

import { useEffect, useState } from 'react'

type DashboardData = {
  ok: boolean
  summary: {
    total: number
    queued: number
    processing: number
    failed: number
    completed: number
  }
  processing: any[]
  failed: any[]
  generated_at: string
}

type RetryObservabilityData = {
  ok: boolean
  generated_at: string
  retry_policy: {
    policy_key: string
    policy_name: string
    is_active: boolean
    max_attempts: number
    retry_schedule_seconds: number[]
    updated_at: string
  } | null
  retry_engine: {
    failed_ready_now: number
    dead_letter_total: number
  }
  recent_retry_events: Array<{
    id: string
    queue_id: string
    file_id: string | null
    event_type: string
    attempt_count: number
    previous_status: string | null
    new_status: string | null
    scheduled_retry_at: string | null
    failure_reason: string | null
    created_at: string
  }>
}

type RetryCycleResponse = {
  ok: boolean
  action?: string
  result?: Array<{
    processed_count: number
    requeued_count: number
    scanned_failed_ready: number
    policy_key: string
    run_started_at: string
    run_completed_at: string
    outcome: string
  }>
  error?: string
}

export default function Home() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [retryObs, setRetryObs] = useState<RetryObservabilityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState<string>('')

  async function fetchDashboard() {
    const res = await fetch('/api/dashboard', { cache: 'no-store' })
    const json = await res.json()
    if (!json.ok) throw new Error(json.error || 'Dashboard API error')
    setDashboard(json)
  }

  async function fetchRetryObservability() {
    const res = await fetch('/api/retry-observability', { cache: 'no-store' })
    const json = await res.json()
    if (!json.ok) throw new Error(json.error || 'Retry observability API error')
    setRetryObs(json)
  }

  async function refreshAll() {
    try {
      await Promise.all([fetchDashboard(), fetchRetryObservability()])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function retryFailed() {
    setActionLoading(true)
    setActionMessage('')

    try {
      const res = await fetch('/api/dashboard-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry_failed' }),
      })

      const json = await res.json()

      if (!json.ok) {
        throw new Error(json.error || 'Retry failed action failed')
      }

      setActionMessage(json.message || 'Retry action completed')
      await refreshAll()
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Retry action failed')
    } finally {
      setActionLoading(false)
    }
  }

  async function runRetryCycle() {
    setActionLoading(true)
    setActionMessage('')

    try {
      const res = await fetch('/api/retry-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy_key: 'queue_default', limit: 50 }),
      })

      const json: RetryCycleResponse = await res.json()

      if (!json.ok) {
        throw new Error(json.error || 'Retry cycle failed')
      }

      const run = json.result?.[0]
      if (run) {
        setActionMessage(
          `Retry cycle completed | scanned=${run.scanned_failed_ready} | requeued=${run.requeued_count} | outcome=${run.outcome}`
        )
      } else {
        setActionMessage('Retry cycle completed')
      }

      await refreshAll()
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Retry cycle failed')
    } finally {
      setActionLoading(false)
    }
  }

  useEffect(() => {
    refreshAll()
    const interval = setInterval(refreshAll, 15000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Loading system...</div>
  }

  if (error) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif', color: 'red' }}>
        System Error: {error}
      </div>
    )
  }

  const summary = dashboard!.summary
  const failedReadyNow = retryObs?.retry_engine.failed_ready_now ?? 0
  const deadLetterTotal = retryObs?.retry_engine.dead_letter_total ?? 0

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>ATHRX — Founder Control Center</h1>

      <div
        style={{
          background: '#e6f4ea',
          padding: 16,
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        ✅ Connected to Supabase
        <br />
        Last update: {new Date(dashboard!.generated_at).toLocaleString()}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button
          onClick={retryFailed}
          disabled={actionLoading}
          style={{
            padding: 12,
            background: '#111',
            color: '#fff',
            borderRadius: 6,
            cursor: 'pointer',
            border: 'none',
          }}
        >
          {actionLoading ? 'Processing...' : 'Retry Failed Jobs'}
        </button>

        <button
          onClick={runRetryCycle}
          disabled={actionLoading}
          style={{
            padding: 12,
            background: '#0b57d0',
            color: '#fff',
            borderRadius: 6,
            cursor: 'pointer',
            border: 'none',
          }}
        >
          {actionLoading ? 'Processing...' : 'Run Retry Cycle'}
        </button>
      </div>

      {actionMessage && (
        <div
          style={{
            background: '#f4f6f8',
            padding: 12,
            borderRadius: 8,
            marginBottom: 20,
            border: '1px solid #d8dee4',
          }}
        >
          {actionMessage}
        </div>
      )}

      {summary.failed > 0 && (
        <div
          style={{
            background: '#fdecea',
            padding: 12,
            marginBottom: 20,
            borderRadius: 8,
            color: '#b71c1c',
          }}
        >
          ⚠️ {summary.failed} failed jobs detected
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, marginBottom: 30, flexWrap: 'wrap' }}>
        <Card label="Total" value={summary.total} />
        <Card label="Queued" value={summary.queued} />
        <Card label="Processing" value={summary.processing} />
        <Card label="Failed" value={summary.failed} />
        <Card label="Completed" value={summary.completed} />
      </div>

      <Section title="Self-Healing Engine">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          <Card label="Failed Ready Now" value={failedReadyNow} />
          <Card label="Dead Letter Total" value={deadLetterTotal} />
          <Card label="Max Attempts" value={retryObs?.retry_policy?.max_attempts ?? 0} />
        </div>

        <div
          style={{
            background: '#fafafa',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <strong>Policy:</strong> {retryObs?.retry_policy?.policy_name || '-'}
          <br />
          <strong>Schedule (seconds):</strong>{' '}
          {retryObs?.retry_policy?.retry_schedule_seconds?.join(', ') || '-'}
          <br />
          <strong>Policy Updated:</strong>{' '}
          {retryObs?.retry_policy?.updated_at
            ? new Date(retryObs.retry_policy.updated_at).toLocaleString()
            : '-'}
        </div>

        <h3 style={{ marginTop: 0 }}>Recent Retry Events</h3>
        {retryObs?.recent_retry_events?.length ? (
          <div
            style={{
              border: '1px dashed #ccc',
              borderRadius: 8,
              padding: 16,
              overflowX: 'auto',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Event</th>
                  <th style={thStyle}>Attempt</th>
                  <th style={thStyle}>Queue ID</th>
                  <th style={thStyle}>From</th>
                  <th style={thStyle}>To</th>
                  <th style={thStyle}>Created</th>
                </tr>
              </thead>
              <tbody>
                {retryObs.recent_retry_events.map((event) => (
                  <tr key={event.id}>
                    <td style={tdStyle}>{event.event_type}</td>
                    <td style={tdStyle}>{event.attempt_count}</td>
                    <td style={tdStyle}>{event.queue_id}</td>
                    <td style={tdStyle}>{event.previous_status || '-'}</td>
                    <td style={tdStyle}>{event.new_status || '-'}</td>
                    <td style={tdStyle}>{new Date(event.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text="No retry events yet" />
        )}
      </Section>

      <Section title="Processing Jobs">
        {dashboard!.processing.length === 0 ? (
          <Empty text="No processing jobs" />
        ) : (
          <pre style={preStyle}>{JSON.stringify(dashboard!.processing, null, 2)}</pre>
        )}
      </Section>

      <Section title="Failed Jobs">
        {dashboard!.failed.length === 0 ? (
          <Empty text="No failed jobs" />
        ) : (
          <pre style={preStyle}>{JSON.stringify(dashboard!.failed, null, 2)}</pre>
        )}
      </Section>
    </div>
  )
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        padding: 20,
        border: '1px solid #ddd',
        borderRadius: 8,
        width: 150,
        background: '#fff',
      }}
    >
      <div style={{ marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24 }}>{value}</div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginTop: 30 }}>
      <h2>{title}</h2>
      <div
        style={{
          border: '1px dashed #ccc',
          padding: 20,
          borderRadius: 8,
          background: '#fff',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div style={{ color: '#888' }}>{text}</div>
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 8px',
  borderBottom: '1px solid #e5e7eb',
  fontSize: 14,
}

const tdStyle: React.CSSProperties = {
  padding: '10px 8px',
  borderBottom: '1px solid #f1f5f9',
  fontSize: 13,
  verticalAlign: 'top',
}

const preStyle: React.CSSProperties = {
  margin: 0,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontSize: 13,
}
