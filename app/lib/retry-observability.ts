import { createClient } from "@supabase/supabase-js";

export async function getRetryObservability() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("MISSING_SUPABASE_ENV");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data, error } = await supabase
    .from("athrx_queue")
    .select("id,status,attempt_count,updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`RETRY_OBSERVABILITY_FETCH_FAILED: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];

  const summary = {
    total: rows.length,
    queued: rows.filter((r) => r.status === "queued").length,
    processing: rows.filter((r) => r.status === "processing").length,
    failed: rows.filter((r) => r.status === "failed").length,
    completed: rows.filter((r) => r.status === "completed").length,
    dead_letter: rows.filter((r) => r.status === "dead_letter").length
  };

  const maxAttemptsObserved = Math.max(
    0,
    ...rows.map((r) => r.attempt_count || 0)
  );

  return {
    ok: true,
    source: "shared",
    job: "retry-observability",
    generated_at: new Date().toISOString(),
    summary,
    max_attempts_observed: maxAttemptsObserved,
    recent: rows.slice(0, 20)
  };
}