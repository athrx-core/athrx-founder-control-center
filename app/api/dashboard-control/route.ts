import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const action = body?.action

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

    if (action === 'retry_failed') {
      const { error, count } = await supabase
        .from('athrx_queue')
        .update({
          status: 'queued',
          next_retry_at: new Date().toISOString(),
          lease_owner: null,
          lease_expires_at: null,
          claimed_at: null,
          last_error: null,
        }, { count: 'exact' })
        .eq('status', 'failed')

      if (error) {
        return NextResponse.json(
          {
            ok: false,
            error: error.message,
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        ok: true,
        action: 'retry_failed',
        message: 'Failed jobs re-queued successfully',
        updated_count: count ?? 0,
        processed_at: new Date().toISOString(),
      })
    }

    return NextResponse.json(
      {
        ok: false,
        error: 'Unknown action',
      },
      { status: 400 }
    )
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
