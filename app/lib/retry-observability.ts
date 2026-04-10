import { createClient } from "@supabase/supabase-js";

export async function getRetryObservability() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return {
        ok: false,
        error: "MISSING_SUPABASE_ENV"
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data, error } = await supabase
      .from("athrx_queue")
      .select("id,status,attempt_count,updated_at");

    if (error) {
      return {
        ok: false,
        error: "SUPABASE_QUERY_FAILED",
        details: error.message
      };
    }

    const rows = Array.isArray(data) ? data : [];

    const summary = {
      total: rows.length,
      queued: rows.filter(r => r.status === "queued").length,
      processing: rows.filter(r => r.status === "processing").length,
      failed: rows.filter(r => r.status === "failed").length,
      completed: rows.filter(r => r.status === "completed").length,
      dead_letter: rows.filter(r => r.status === "dead_letter").length
    };

    const maxAttemptsObserved = rows.length
      ? Math.max(...rows.map(r => r.attempt_count || 0))
      : 0;

    return {
      ok: true,
      summary,
      max_attempts_observed: maxAttemptsObserved,
      rows
    };

  } catch (err: any) {
    return {
      ok: false,
      error: "UNEXPECTED_RUNTIME_ERROR",
      details: err?.message || "unknown_error"
    };
  }
}