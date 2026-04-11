import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || ''

async function safeFetch(path: string) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      cache: 'no-store'
    })

    if (!res.ok) return null

    return await res.json()
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const [retryObs, failureObs] = await Promise.all([
      safeFetch('/api/retry-observability'),
      safeFetch('/api/failure-observability')
    ])

    // ======================
    // QUEUE SUMMARY
    // ======================
    const summary = retryObs?.summary || {
      total: 0,
      queued: 0,
      processing: 0,
      failed: 0,
      completed: 0
    }

    const deadLetter = failureObs?.dead_letter_total || 0

    // ======================
    // RETRY
    // ======================
    const retry = {
      ready_now: retryObs?.ready_now || 0,
      max_attempts: retryObs?.max_attempts || 0,
      schedule: retryObs?.schedule || [],
      last_run: retryObs?.generated_at || null
    }

    // ======================
    // FAILURE
    // ======================
    const failure = {
      total_failed: failureObs?.total_failed || 0,
      dead_letter: deadLetter,
      breakdown: failureObs?.breakdown || []
    }

    // ======================
    // SELF HEALING
    // ======================
    const healing = {
      last_run: retryObs?.generated_at || null,
      processed: retryObs?.healing_processed || 0
    }

    return NextResponse.json({
      ok: true,
      generated_at: new Date().toISOString(),

      queue: {
        total: summary.total,
        queued: summary.queued,
        processing: summary.processing,
        completed: summary.completed,
        dead_letter: deadLetter
      },

      retry,
      failure,
      healing
    })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: 'dashboard_aggregation_failed'
      },
      { status: 500 }
    )
  }
}