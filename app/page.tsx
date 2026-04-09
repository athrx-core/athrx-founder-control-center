'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type QueueStat = {
  status: string
  count: number
}

type Job = {
  id: string
  file_id: string
  attempt_count: number
  lease_owner: string | null
  last_error?: string | null
}

export default function Page() {
  const [status, setStatus] = useState('Loading...')
  const [stats, setStats] = useState<QueueStat[]>([])
  const [processing, setProcessing] = useState<Job[]>([])
  const [failed, setFailed] = useState<Job[]>([])

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  const supabase = useMemo<SupabaseClient | null>(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null
    return createClient(supabaseUrl, supabaseAnonKey)
  }, [supabaseUrl, supabaseAnonKey])

  useEffect(() => {
    async function loadData() {
      try {
        if (!supabase) {
          setStatus('❌ Missing env')
          return
        }

        // Queue Stats
        const { data: statData, error: statError } = await supabase.rpc(
          'athrx_queue_status_counts'
        )

        // Fallback if RPC not created
        if (!statData || statError) {
          const { data } = await supabase
            .from('athrx_queue')
            .select('status')

          const counts: Record<string, number> = {}
          data?.forEach((row) => {
            counts[row.status] = (counts[row.status] || 0) + 1
          })

          setStats(
            Object.entries(counts).map(([status, count]) => ({
              status,
              count,
            }))
          )
        } else {
          setStats(statData)
        }

        // Processing Jobs
        const { data: processingData } = await supabase
          .from('athrx_queue')
          .select('id,file_id,attempt_count,lease_owner')
          .eq('status', 'processing')
          .limit(10)

        setProcessing(processingData || [])

        // Failed Jobs
        const { data: failedData } = await supabase
          .from('athrx_queue')
          .select('id,file_id,attempt_count,last_error')
          .eq('status', 'failed')
          .limit(10)

        setFailed(failedData || [])

        setStatus('✅ System Live')
      } catch (err) {
        setStatus('❌ Error loading data')
      }
    }

    loadData()
  }, [supabase])

  return (
    <main style={{ padding: 40, fontFamily: 'system-ui' }}>
      <h1>ATHRX — Founder Control Center</h1>

      <p>{status}</p>

      <h2>Queue Status</h2>
      <ul>
        {stats.map((s) => (
          <li key={s.status}>
            {s.status}: {s.count}
          </li>
        ))}
      </ul>

      <h2>Processing</h2>
      <ul>
        {processing.map((j) => (
          <li key={j.id}>
            {j.id} — {j.lease_owner}
          </li>
        ))}
      </ul>

      <h2>Failed</h2>
      <ul>
        {failed.map((j) => (
          <li key={j.id}>
            {j.id} — {j.last_error}
          </li>
        ))}
      </ul>
    </main>
  )
}