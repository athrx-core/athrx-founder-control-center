'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function Page() {
  const [status, setStatus] = useState('Checking connection...')
  const [time, setTime] = useState('')

  useEffect(() => {
    async function checkConnection() {
      try {
        const { data, error } = await supabase.from('athrx_queue').select('*').limit(1)

        if (error) throw error

        setStatus('✅ Connected to Supabase')
        setTime(new Date().toLocaleString())
      } catch (err) {
        setStatus('❌ Connection failed')
      }
    }

    checkConnection()
  }, [])

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