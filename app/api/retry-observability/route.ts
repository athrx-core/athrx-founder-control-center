import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing server environment variables',
        },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const [
      policyResult,
      failedReadyResult,
      deadLetterResult,
      retryEventsResult,
    ] = await Promise.all([
      supabase
        .from('athrx_retry_policy')
        .select('policy_key, policy_name, is_active, max_attempts, retry_schedule_seconds, updated_at')
        .eq('policy_key', 'queue_default')
        .maybeSingle(),

      supabase
        .from('athrx_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed')
        .not('next_retry_at', 'is', null)
        .lte('next_retry_at', new Date().toISOString()),

      supabase
        .from('athrx_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'dead_letter'),

      supabase
        .from('athrx_retry_events')
        .select('id, queue_id, file_id, event_type, attempt_count, previous_status, new_status, scheduled_retry_at, failure_reason, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    if (policyResult.error) {
      return NextResponse.json({ ok: false, error: policyResult.error.message }, { status: 500 })
    }

    if (failedReadyResult.error) {
      return NextResponse.json({ ok: false, error: failedReadyResult.error.message }, { status: 500 })
    }

    if (deadLetterResult.error) {
      return NextResponse.json({ ok: false, error: deadLetterResult.error.message }, { status: 500 })
    }

    if (retryEventsResult.error) {
      return NextResponse.json({ ok: false, error: retryEventsResult.error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      generated_at: new Date().toISOString(),
      retry_policy: policyResult.data,
      retry_engine: {
        failed_ready_now: failedReadyResult.count ?? 0,
        dead_letter_total: deadLetterResult.count ?? 0,
      },
      recent_retry_events: retryEventsResult.data ?? [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown server error',
      },
      { status: 500 }
    )
  }
}
