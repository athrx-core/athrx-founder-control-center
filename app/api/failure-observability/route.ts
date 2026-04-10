import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type QueueRow = {
  id: string;
  status: string | null;
  failure_class: string | null;
  last_error: string | null;
  attempt_count: number | null;
  created_at: string | null;
  updated_at: string | null;
  drive_file_id: string | null;
};

export async function GET() {
  const startedAt = Date.now();

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "MISSING_SUPABASE_ENV",
          details: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured"
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: queueRows, error: queueError } = await supabase
      .from("athrx_queue")
      .select(
        "id,status,failure_class,last_error,attempt_count,created_at,updated_at,drive_file_id"
      )
      .in("status", ["failed", "dead_letter"])
      .order("updated_at", { ascending: false });

    if (queueError) {
      return NextResponse.json(
        {
          ok: false,
          error: "FAILED_TO_FETCH_FAILURE_ROWS",
          details: queueError.message
        },
        { status: 500 }
      );
    }

    const rows: QueueRow[] = Array.isArray(queueRows) ? queueRows : [];

    const failedRows = rows.filter((row) => row.status === "failed");
    const deadLetterRows = rows.filter((row) => row.status === "dead_letter");

    const failurePatternMap = new Map<
      string,
      {
        failure_class: string;
        total: number;
        failed_count: number;
        dead_letter_count: number;
        latest_updated_at: string | null;
      }
    >();

    for (const row of rows) {
      const key =
        row.failure_class?.trim() ||
        row.last_error?.trim() ||
        "UNKNOWN_FAILURE_CLASS";

      const existing = failurePatternMap.get(key);

      if (!existing) {
        failurePatternMap.set(key, {
          failure_class: key,
          total: 1,
          failed_count: row.status === "failed" ? 1 : 0,
          dead_letter_count: row.status === "dead_letter" ? 1 : 0,
          latest_updated_at: row.updated_at ?? row.created_at ?? null
        });
      } else {
        existing.total += 1;
        if (row.status === "failed") existing.failed_count += 1;
        if (row.status === "dead_letter") existing.dead_letter_count += 1;

        const currentTs = existing.latest_updated_at
          ? new Date(existing.latest_updated_at).getTime()
          : 0;
        const rowTs = row.updated_at ? new Date(row.updated_at).getTime() : 0;

        if (rowTs > currentTs) {
          existing.latest_updated_at = row.updated_at ?? row.created_at ?? null;
        }
      }
    }

    const failurePatterns = Array.from(failurePatternMap.values()).sort(
      (a, b) => b.total - a.total
    );

    const recentFailureRows = rows.slice(0, 20).map((row) => ({
      id: row.id,
      status: row.status,
      failure_class: row.failure_class,
      last_error: row.last_error,
      attempt_count: row.attempt_count ?? 0,
      drive_file_id: row.drive_file_id,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    return NextResponse.json({
      ok: true,
      generated_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      summary: {
        total_failure_rows: rows.length,
        failed_count: failedRows.length,
        dead_letter_count: deadLetterRows.length
      },
      failure_patterns: failurePatterns,
      recent_failure_rows: recentFailureRows
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "FAILURE_OBSERVABILITY_SYSTEM_ERROR",
        details: error?.message || "unknown_error"
      },
      { status: 500 }
    );
  }
}