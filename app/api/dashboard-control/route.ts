import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// ✅ GET (للتحقق فقط)
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'dashboard-control API is working',
  })
}

// 🔥 POST (التحكم الفعلي)
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
        })
        .eq('status', 'failed')

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        ok: true,
        message: 'Failed jobs re-queued',
        affected: count,
      })
    }

    return NextResponse.json(
      { ok: false, error: 'Unknown action' },
      { status: 400 }
    )
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message },
      { status: 500 }
    )
  }
}