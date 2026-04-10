import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // 1. جلب jobs الفاشلة
    const { data: failedJobs, error } = await supabase
      .from('athrx_queue')
      .select('*')
      .eq('status', 'failed')
      .limit(20)

    if (error) throw error

    const results: any[] = []

    for (const job of failedJobs || []) {
      // 2. تصنيف الفشل
      const { data: classification } = await supabase.rpc(
        'athrx_resolve_failure_action',
        {
          p_error_text: job.last_error,
          p_attempt_count: job.attempt_count,
        }
      )

      const decision = classification?.[0]

      if (!decision) continue

      // 3. تطبيق القرار
      if (decision.action_decision === 'retry') {
        // 🧠 تعديل ذكي قبل retry
        let newPayload = job.payload

        if (decision.failure_class === 'AI_EMPTY_RESPONSE') {
          newPayload = {
            ...job.payload,
            force_response: true,
            temperature: 0.3,
          }
        }

        await supabase
          .from('athrx_queue')
          .update({
            status: 'queued',
            payload: newPayload,
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id)

        results.push({
          id: job.id,
          action: 'retry_with_fix',
          fix: decision.failure_class,
        })
      }

      if (decision.action_decision === 'dead_letter') {
        await supabase
          .from('athrx_queue')
          .update({
            status: 'dead_letter',
          })
          .eq('id', job.id)

        results.push({
          id: job.id,
          action: 'dead_letter',
        })
      }

      if (decision.action_decision === 'quarantine') {
        await supabase
          .from('athrx_queue')
          .update({
            status: 'quarantined',
          })
          .eq('id', job.id)

        results.push({
          id: job.id,
          action: 'quarantine',
        })
      }
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
      results,
    })
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message,
    })
  }
}