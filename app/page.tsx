'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type QueueSummary = {
  total: number
  queued: number
  processing: number
  failed: number
  completed: number
}

type ProcessingJob = {
  id: string
  file_id: string
  attempt_count: number
  lease_owner: string | null
  status: string | null
}

type FailedJob = {
  id: string
  file_id: string
  attempt_count: number
  last_error: string | null
}

export default function HomePage() {
  const [status, setStatus] = useState('Checking connection...')
  const [lastCheck, setLastCheck] = useState('')
  const [summary, setSummary] = useState<QueueSummary>({
    total: 0,
    queued: 0,
    processing: 0,
    failed: 0,
    completed: 0,
  })
  const [processing, setProcessing] = useState<ProcessingJob[]>([])
  const [failed, setFailed] = useState<FailedJob[]>([])

  useEffect(() => {
    const runCheck = async () => {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        if (!supabaseUrl || !supabaseAnonKey) {
          setStatus('❌ Missing client environment variables')
          setLastCheck(new Date().toLocaleString())
          return
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey)

        const { count: totalCount, error: totalError } = await supabase
          .from('athrx_queue')
          .select('*', { count: 'exact', head: true })

        if (totalError) {
          throw totalError
        }

        const { count: queuedCount } = await supabase
          .from('athrx_queue')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'queued')

        const { count: processingCount } = await supabase
          .from('athrx_queue')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'processing')

        const { count: failedCount } = await supabase
          .from('athrx_queue')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'failed')

        const { count: completedCount } = await supabase
          .from('athrx_queue')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed')

        const { data: processingData, error: processingError } = await supabase
          .from('athrx_queue')
          .select('id, file_id, attempt_count, lease_owner, status')
          .eq('status', 'processing')
          .order('claimed_at', { ascending: false })
          .limit(10)

        if (processingError) {
          throw processingError
        }

        const { data: failedData, error: failedError } = await supabase
          .from('athrx_queue')
          .select('id, file_id, attempt_count, last_error')
          .eq('status', 'failed')
          .order('updated_at', { ascending: false })
          .limit(10)

        if (failedError) {
          throw failedError
        }

        setSummary({
          total: totalCount ?? 0,
          queued: queuedCount ?? 0,
          processing: processingCount ?? 0,
          failed: failedCount ?? 0,
          completed: completedCount ?? 0,
        })

        setProcessing((processingData ?? []) as ProcessingJob[])
        setFailed((failedData ?? []) as FailedJob[])

        setStatus('✅ Connected to Supabase')
        setLastCheck(new Date().toLocaleString())
      } catch (error) {
        setStatus(
          `❌ ${
            error instanceof Error ? error.message : 'Unknown connection error'
          }`
        )
        setLastCheck(new Date().toLocaleString())
      }
    }

    runCheck()
  }, [])

  return (
    <main
      style={{
        padding: '48px',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: '#111827',
        background: '#f8fafc',
        minHeight: '100vh',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1
          style={{
            fontSize: '56px',
            fontWeight: 800,
            marginBottom: '20px',
            letterSpacing: '-0.02em',
          }}
        >
          ATHRX — Founder Control Center
        </h1>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '24px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ fontSize: '32px', fontWeight: 700, marginBottom: '12px' }}>
            {status}
          </div>
          <div style={{ fontSize: '18px', color: '#6b7280' }}>
            Last check: {lastCheck || '-'}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
            gap: '16px',
            marginBottom: '24px',
          }}
        >
          <MetricCard label="Total Jobs" value={summary.total} />
          <MetricCard label="Queued" value={summary.queued} />
          <MetricCard label="Processing" value={summary.processing} />
          <MetricCard label="Failed" value={summary.failed} />
          <MetricCard label="Completed" value={summary.completed} />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
          }}
        >
          <section
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>
              Processing Jobs
            </h2>

            {processing.length === 0 ? (
              <EmptyState text="No processing jobs found." />
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {processing.map((job) => (
                  <div
                    key={job.id}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '16px',
                      background: '#f9fafb',
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: '6px' }}>
                      Queue ID: {job.id}
                    </div>
                    <div style={{ color: '#374151', marginBottom: '4px' }}>
                      File ID: {job.file_id}
                    </div>
                    <div style={{ color: '#374151', marginBottom: '4px' }}>
                      Attempt Count: {job.attempt_count}
                    </div>
                    <div style={{ color: '#374151', marginBottom: '4px' }}>
                      Lease Owner: {job.lease_owner || '-'}
                    </div>
                    <div style={{ color: '#374151' }}>
                      Status: {job.status || '-'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px' }}>
              Failed Jobs
            </h2>

            {failed.length === 0 ? (
              <EmptyState text="No failed jobs found." />
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
                {failed.map((job) => (
                  <div
                    key={job.id}
                    style={{
                      border: '1px solid #fecaca',
                      borderRadius: '12px',
                      padding: '16px',
                      background: '#fef2f2',
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: '6px' }}>
                      Queue ID: {job.id}
                    </div>
                    <div style={{ color: '#374151', marginBottom: '4px' }}>
                      File ID: {job.file_id}
                    </div>
                    <div style={{ color: '#374151', marginBottom: '4px' }}>
                      Attempt Count: {job.attempt_count}
                    </div>
                    <div style={{ color: '#991b1b' }}>
                      Last Error: {job.last_error || '-'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
        {label}
      </div>
      <div style={{ fontSize: '32px', fontWeight: 800 }}>{value}</div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        border: '1px dashed #d1d5db',
        borderRadius: '12px',
        padding: '20px',
        textAlign: 'center',
        color: '#6b7280',
        background: '#f9fafb',
      }}
    >
      {text}
    </div>
  )
}