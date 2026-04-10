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
      deadLetterResult,
      quarantinedResult,
      failedResult,
      recentQueueResult,
      patternsResult,
    ] = await Promise.all([
      supabase
        .from('athrx_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'dead_letter'),

      supabase
        .from('athrx_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'quarantined'),

      supabase
        .from('athrx_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed'),

      supabase
        .from('athrx_queue')
        .select('id, file_id, status, attempt_count, last_error, updated_at')
        .order('updated_at', { ascending: false })
        .limit(15),

      supabase
        .from('athrx_failure_patterns')
        .select(
          'pattern_key, pattern_name, failure_class, is_retryable, recommended_status, priority, is_active, updated_at'
        )
        .eq('is_active', true)
        .order('priority', { ascending: true }),
    ])

    if (deadLetterResult.error) {
      return NextResponse.json({ ok: false, error: deadLetterResult.error.message }, { status: 500 })
    }

    if (quarantinedResult.error) {
      return NextResponse.json({ ok: false, error: quarantinedResult.error.message }, { status: 500 })
    }

    if (failedResult.error) {
      return NextResponse.json({ ok: false, error: failedResult.error.message }, { status: 500 })
    }

    if (recentQueueResult.error) {
      return NextResponse.json({ ok: false, error: recentQueueResult.error.message }, { status: 500 })
    }

    if (patternsResult.error) {
      return NextResponse.json({ ok: false, error: patternsResult.error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      generated_at: new Date().toISOString(),
      summary: {
        failed: failedResult.count ?? 0,
        dead_letter: deadLetterResult.count ?? 0,
        quarantined: quarantinedResult.count ?? 0,
      },
      recent_queue_rows: recentQueueResult.data ?? [],
      active_patterns: patternsResult.data ?? [],
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