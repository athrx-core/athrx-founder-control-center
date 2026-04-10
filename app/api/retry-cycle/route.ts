import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'retry-cycle API is working',
  })
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const limit =
      typeof body?.limit === 'number' && body.limit > 0 ? body.limit : 50
    const policyKey =
      typeof body?.policy_key === 'string' && body.policy_key.trim()
        ? body.policy_key.trim()
        : 'queue_default'

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

    const { data, error } = await supabase.rpc('athrx_run_retry_cycle', {
      p_policy_key: policyKey,
      p_limit: limit,
    })

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
      action: 'retry_cycle_executed',
      result: data ?? [],
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
