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

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function fetchData() {
    try {
      const res = await fetch('/api/dashboard')
      const json = await res.json()

      if (!json.ok) {
        throw new Error(json.error || 'API error')
      }

      setData(json)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()

    const interval = setInterval(fetchData, 15000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return <div style={{ padding: 40 }}>Loading system...</div>
  }

  if (error) {
    return (
      <div style={{ padding: 40, color: 'red' }}>
        System Error: {error}
      </div>
    )
  }

  const s = data!.summary

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h1>ATHRX — Founder Control Center</h1>

      <div style={{
        background: '#e6f4ea',
        padding: 16,
        borderRadius: 8,
        marginBottom: 20
      }}>
        ✅ Connected to Supabase <br />
        Last update: {new Date(data!.generated_at).toLocaleString()}
      </div>

      {/* Alerts */}
      {s.failed > 0 && (
        <div style={{
          background: '#fdecea',
          padding: 12,
          marginBottom: 20,
          borderRadius: 8,
          color: '#b71c1c'
        }}>
          ⚠️ {s.failed} failed jobs detected
        </div>
      )}

      {s.processing > 0 && (
        <div style={{
          background: '#fff8e1',
          padding: 12,
          marginBottom: 20,
          borderRadius: 8
        }}>
          ⚡ {s.processing} jobs currently processing
        </div>
      )}

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 16 }}>
        <Card label="Total" value={s.total} />
        <Card label="Queued" value={s.queued} />
        <Card label="Processing" value={s.processing} />
        <Card label="Failed" value={s.failed} />
        <Card label="Completed" value={s.completed} />
      </div>

      {/* Processing */}
      <Section title="Processing Jobs">
        {data!.processing.length === 0
          ? <Empty text="No processing jobs" />
          : JSON.stringify(data!.processing)}
      </Section>

      {/* Failed */}
      <Section title="Failed Jobs">
        {data!.failed.length === 0
          ? <Empty text="No failed jobs" />
          : JSON.stringify(data!.failed)}
      </Section>
    </div>
  )
}

function Card({ label, value }: { label: string, value: number }) {
  return (
    <div style={{
      padding: 20,
      border: '1px solid #ddd',
      borderRadius: 8,
      width: 120
    }}>
      <div>{label}</div>
      <div style={{ fontSize: 24 }}>{value}</div>
    </div>
  )
}

function Section({ title, children }: any) {
  return (
    <div style={{ marginTop: 30 }}>
      <h3>{title}</h3>
      <div style={{
        border: '1px dashed #ccc',
        padding: 20,
        borderRadius: 8
      }}>
        {children}
      </div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div style={{ color: '#888' }}>{text}</div>
}