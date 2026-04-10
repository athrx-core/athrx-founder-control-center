import { NextResponse } from "next/server";
import { getRetryObservability } from "@/app/lib/retry-observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const start = Date.now();

  try {
    const result = await getRetryObservability();

    return NextResponse.json({
      ok: true,
      job: "retry-observability",
      ran_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      result
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        job: "retry-observability",
        ran_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
        error: "RETRY_OBSERVABILITY_CRON_FAILED",
        details: error?.message || "unknown_error"
      },
      { status: 500 }
    );
  }
}