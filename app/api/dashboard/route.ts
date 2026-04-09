import { NextResponse } from 'next/server'
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
  claimed_at?: string | null
}

type FailedJob = {
  id: string
  file_id: string
  attempt_count: number
  last_error: string | null
  updated_at?: string | null
}

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing server environment variables',
          missing: {
            NEXT_PUBLIC_SUPABASE_URL: !supabaseUrl,
            SUPABASE_SERVICE_ROLE_KEY: !serviceRoleKey,
          },
        },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const [
      totalResult,
      queuedResult,
      processingResult,
      failedResult,
      completedResult,
      processingRowsResult,
      failedRowsResult,
    ] = await Promise.all([
      supabase.from('athrx_queue').select('*', { count: 'exact', head: true }),
      supabase
        .from('athrx_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'queued'),
      supabase
        .from('athrx_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'processing'),
      supabase
        .from('athrx_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed'),
      supabase
        .from('athrx_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed'),
      supabase
        .from('athrx_queue')
        .select('id, file_id, attempt_count, lease_owner, status, claimed_at')
        .eq('status', 'processing')
        .order('claimed_at', { ascending: false })
        .limit(10),
      supabase
        .from('athrx_queue')
        .select('id, file_id, attempt_count, last_error, updated_at')
        .eq('status', 'failed')
        .order('updated_at', { ascending: false })
        .limit(10),
    ])

    const countErrors = [
      totalResult.error,
      queuedResult.error,
      processingResult.error,
      failedResult.error,
      completedResult.error,
    ].filter(Boolean)

    if (countErrors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: countErrors[0]?.message || 'Failed to load queue summary',
        },
        { status: 500 }
      )
    }

    if (processingRowsResult.error) {
      return NextResponse.json(
        {
          ok: false,
          error: processingRowsResult.error.message,
        },
        { status: 500 }
      )
    }

    if (failedRowsResult.error) {
      return NextResponse.json(
        {
          ok: false,
          error: failedRowsResult.error.message,
        },
        { status: 500 }
      )
    }

    const summary: QueueSummary = {
      total: totalResult.count ?? 0,
      queued: queuedResult.count ?? 0,
      processing: processingResult.count ?? 0,
      failed: failedResult.count ?? 0,
      completed: completedResult.count ?? 0,
    }

    const processing: ProcessingJob[] =
      (processingRowsResult.data as ProcessingJob[] | null) ?? []

    const failed: FailedJob[] =
      (failedRowsResult.data as FailedJob[] | null) ?? []

    return NextResponse.json({
      ok: true,
      generated_at: new Date().toISOString(),
      summary,
      processing,
      failed,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : 'Unknown server error',
      },
      { status: 500 }
    )
  }
}