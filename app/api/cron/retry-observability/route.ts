import { NextResponse } from "next/server";
import { getRetryObservability } from "../../../../lib/retry-observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await getRetryObservability();

    return NextResponse.json({
      ok: true,
      job: "retry-observability",
      ran_at: new Date().toISOString(),
      duration_ms: 0,
      result
    });

  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        job: "retry-observability",
        error: "RETRY_OBSERVABILITY_CRON_FAILED",
        details: error?.message || "unknown_error"
      },
      { status: 500 }
    );
  }
}