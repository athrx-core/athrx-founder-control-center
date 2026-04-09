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

    const { data: queueRows, error: queueError } = await supabase
      .from('athrx_queue')
      .select('status')

    if (queueError) {
      return NextResponse.json(
        {
          ok: false,
          error: queueError.message,
        },
        { status: 500 }
      )
    }

    const summaryMap: Record<string, number> = {}
    for (const row of queueRows ?? []) {
      const status = row.status ?? 'unknown'
      summaryMap[status] = (summaryMap[status] || 0) + 1
    }

    const summary = Object.entries(summaryMap).map(([status, count]) => ({
      status,
      count,
    }))

    const { data: processingRows, error: processingError } = await supabase
      .from('athrx_queue')
      .select('id,file_id,attempt_count,lease_owner,claimed_at')
      .eq('status', 'processing')
      .limit(10)

    if (processingError) {
      return NextResponse.json(
        {
          ok: false,
          error: processingError.message,
        },
        { status: 500 }
      )
    }

    const { data: failedRows, error: failedError } = await supabase
      .from('athrx_queue')
      .select('id,file_id,attempt_count,last_error,updated_at')
      .eq('status', 'failed')
      .limit(10)

    if (failedError) {
      return NextResponse.json(
        {
          ok: false,
          error: failedError.message,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      generated_at: new Date().toISOString(),
      summary,
      processing: processingRows ?? [],
      failed: failedRows ?? [],
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
