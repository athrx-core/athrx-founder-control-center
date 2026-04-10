import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

type QueueRow = {
  id: string
  file_id: string | null
  status: string
  attempt_count: number | null
  last_error: string | null
  updated_at: string | null
  next_retry_at: string | null
}

type FailureResolution = {
  failure_class: string | null
  is_retryable: boolean | null
  recommended_status: string | null
  matched_pattern_key: string | null
  action_decision: string | null
  reason: string | null
}

type HealingResult = {
  queue_id: string
  file_id: string | null
  source_status: string
  target_status: string
  failure_class: string | null
  matched_pattern_key: string | null
  action_decision: string
  is_retryable: boolean
  attempt_count: number
  reason: string | null
}

const AUTO_RECOVERABLE_DEAD_LETTER_CLASSES = new Set([
  'AI_EMPTY_RESPONSE',
  'AI_INVALID_OUTPUT',
  'NETWORK_TIMEOUT',
  'DRIVE_DOWNLOAD_FAILED',
])

const DEFAULT_MAX_ATTEMPTS = 5
const DEAD_LETTER_EXTRA_RECOVERY_BUFFER = 1
const SCAN_LIMIT = 25

export async function POST() {
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

    let maxAttempts = DEFAULT_MAX_ATTEMPTS

    const policyResponse = await supabase
      .from('athrx_retry_policies')
      .select('max_attempts')
      .eq('policy_key', 'queue_default')
      .maybeSingle()

    if (!policyResponse.error && policyResponse.data?.max_attempts) {
      maxAttempts = Number(policyResponse.data.max_attempts) || DEFAULT_MAX_ATTEMPTS
    }

    const queueResponse = await supabase
      .from('athrx_queue')
      .select('id, file_id, status, attempt_count, last_error, updated_at, next_retry_at')
      .in('status', ['failed', 'dead_letter'])
      .order('updated_at', { ascending: true })
      .limit(SCAN_LIMIT)

    if (queueResponse.error) {
      throw queueResponse.error
    }

    const queueRows: QueueRow[] = queueResponse.data ?? []
    const results: HealingResult[] = []

    let scanned = 0
    let processed = 0
    let requeuedFromFailed = 0
    let requeuedFromDeadLetter = 0
    let deadLettered = 0
    let skipped = 0

    for (const row of queueRows) {
      scanned += 1

      const resolutionResponse = await supabase.rpc('athrx_resolve_failure_action', {
        p_error_text: row.last_error,
        p_attempt_count: row.attempt_count ?? 0,
      })

      if (resolutionResponse.error) {
        throw resolutionResponse.error
      }

      const resolutionArray = (resolutionResponse.data ?? []) as FailureResolution[]
      const resolution = resolutionArray[0] ?? null

      const failureClass = resolution?.failure_class ?? 'UNKNOWN'
      const matchedPatternKey = resolution?.matched_pattern_key ?? null
      const isRetryable = Boolean(resolution?.is_retryable)
      const actionDecision =
        resolution?.action_decision ??
        (isRetryable ? 'retry' : resolution?.recommended_status === 'dead_letter' ? 'dead_letter' : 'skip')
      const reason = resolution?.reason ?? 'no_resolution'

      let targetStatus = row.status
      let shouldUpdate = false

      if (row.status === 'failed') {
        if (actionDecision === 'retry' && isRetryable) {
          targetStatus = 'queued'
          shouldUpdate = true
        } else if (actionDecision === 'dead_letter' || !isRetryable) {
          targetStatus = 'dead_letter'
          shouldUpdate = true
        }
      } else if (row.status === 'dead_letter') {
        const withinRecoveryCap =
          (row.attempt_count ?? 0) <= maxAttempts + DEAD_LETTER_EXTRA_RECOVERY_BUFFER

        const isAutoRecoverableDeadLetter =
          isRetryable &&
          withinRecoveryCap &&
          AUTO_RECOVERABLE_DEAD_LETTER_CLASSES.has(failureClass)

        if (isAutoRecoverableDeadLetter) {
          targetStatus = 'queued'
          shouldUpdate = true
        }
      }

      if (shouldUpdate) {
        const updatePayload: Record<string, unknown> = {
          status: targetStatus,
          updated_at: new Date().toISOString(),
        }

        if (targetStatus === 'queued') {
          updatePayload.lease_owner = null
          updatePayload.lease_expires_at = null
          updatePayload.claimed_at = null
          updatePayload.next_retry_at = null
        }

        const updateResponse = await supabase
          .from('athrx_queue')
          .update(updatePayload)
          .eq('id', row.id)

        if (updateResponse.error) {
          throw updateResponse.error
        }

        const logResponse = await supabase
          .from('athrx_self_healing_logs')
          .insert({
            queue_id: row.id,
            file_id: row.file_id,
            source_status: row.status,
            target_status: targetStatus,
            failure_class: failureClass,
            matched_pattern_key: matchedPatternKey,
            action_decision,
            is_retryable: isRetryable,
            attempt_count: row.attempt_count ?? 0,
            reason,
            metadata: {
              last_error: row.last_error,
              next_retry_at: row.next_retry_at,
              updated_at: row.updated_at,
              policy_max_attempts: maxAttempts,
              dead_letter_extra_recovery_buffer: DEAD_LETTER_EXTRA_RECOVERY_BUFFER,
            },
          })

        if (logResponse.error) {
          throw logResponse.error
        }

        processed += 1

        if (row.status === 'failed' && targetStatus === 'queued') {
          requeuedFromFailed += 1
        }

        if (row.status === 'dead_letter' && targetStatus === 'queued') {
          requeuedFromDeadLetter += 1
        }

        if (targetStatus === 'dead_letter') {
          deadLettered += 1
        }

        results.push({
          queue_id: row.id,
          file_id: row.file_id,
          source_status: row.status,
          target_status: targetStatus,
          failure_class: failureClass,
          matched_pattern_key: matchedPatternKey,
          action_decision,
          is_retryable: isRetryable,
          attempt_count: row.attempt_count ?? 0,
          reason,
        })
      } else {
        skipped += 1
      }
    }

    return NextResponse.json({
      ok: true,
      scanned,
      processed,
      requeued_from_failed: requeuedFromFailed,
      requeued_from_dead_letter: requeuedFromDeadLetter,
      dead_lettered: deadLettered,
      skipped,
      max_attempts: maxAttempts,
      results,
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