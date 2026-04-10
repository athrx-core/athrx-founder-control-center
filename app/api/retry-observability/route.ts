import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "MISSING_SUPABASE_ENV"
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data, error } = await supabase
      .from("athrx_queue")
      .select("id,status,attempt_count,updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "RETRY_OBSERVABILITY_FETCH_FAILED",
          details: error.message
        },
        { status: 500 }
      );
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

    const maxAttempts = Math.max(
      0,
      ...rows.map(r => r.attempt_count || 0)
    );

    return NextResponse.json({
      ok: true,
      generated_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      summary,
      max_attempts_observed: maxAttempts,
      recent: rows.slice(0, 20)
    });

  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "RETRY_OBSERVABILITY_SYSTEM_ERROR",
        details: error?.message || "unknown_error"
      },
      { status: 500 }
    );
  }
}