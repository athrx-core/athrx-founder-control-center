import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const startedAt = Date.now();

  try {
    const supabaseUrl =
      process.env.SUPABASE_URL?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
      "";

    const supabaseServiceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

    if (!supabaseUrl) {
      return NextResponse.json(
        {
          ok: false,
          job: "retry-observability",
          ran_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt,
          error: "MISSING_SUPABASE_URL"
        },
        { status: 500 }
      );
    }

    if (!supabaseServiceRoleKey) {
      return NextResponse.json(
        {
          ok: false,
          job: "retry-observability",
          ran_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt,
          error: "MISSING_SUPABASE_SERVICE_ROLE_KEY"
        },
        { status: 500 }
      );
    }

    if (!/^https?:\/\/.+/i.test(supabaseUrl)) {
      return NextResponse.json(
        {
          ok: false,
          job: "retry-observability",
          ran_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt,
          error: "INVALID_SUPABASE_URL",
          details: supabaseUrl
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data, error } = await supabase
      .from("athrx_queue")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          job: "retry-observability",
          ran_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt,
          error: "SUPABASE_QUERY_FAILED",
          details: error.message
        },
        { status: 500 }
      );
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

    const maxAttemptsObserved = rows.length
      ? Math.max(...rows.map((r) => Number(r.attempt_count || 0)))
      : 0;

    return NextResponse.json({
      ok: true,
      job: "retry-observability",
      ran_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      summary,
      max_attempts_observed: maxAttemptsObserved,
      rows
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        job: "retry-observability",
        ran_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
        error: "UNEXPECTED_RUNTIME_ERROR",
        details: error?.message || "unknown_error"
      },
      { status: 500 }
    );
  }
}