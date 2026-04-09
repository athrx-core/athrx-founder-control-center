'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export default function Page() {
  const [status, setStatus] = useState('Checking connection...')
  const [time, setTime] = useState('')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  const supabase = useMemo<SupabaseClient | null>(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null
    return createClient(supabaseUrl, supabaseAnonKey)
  }, [supabaseUrl, supabaseAnonKey])

  useEffect(() => {
    async function checkConnection() {
      try {
        if (!supabase) {
          setStatus('❌ Missing Supabase environment variables')
          setTime(new Date().toLocaleString())
          return
        }

        const { error } = await supabase
          .from('athrx_queue')
          .select('id', { head: true, count: 'exact' })

        if (error) throw error

        setStatus('✅ Connected to Supabase')
      } catch (error) {
        console.error('Founder Control Center connection check failed:', error)
        setStatus('❌ Connection failed')
      } finally {
        setTime(new Date().toLocaleString())
      }
    }

    checkConnection()
  }, [supabase])

  return (
    <main style={{ padding: '40px', fontFamily: 'system-ui' }}>
      <h1>ATHRX — Founder Control Center</h1>

      <p style={{ marginTop: 20, fontSize: 18 }}>
        {status}
      </p>

      <p style={{ marginTop: 10, color: '#666' }}>
        Last check: {time}
      </p>
    </main>
  )
}