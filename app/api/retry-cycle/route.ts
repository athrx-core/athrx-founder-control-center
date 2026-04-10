import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const start = Date.now();

  try {
    const baseUrl = new URL(request.url).origin;

    const res = await fetch(`${baseUrl}/api/retry-cycle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    });

    const data = await res.json();

    return NextResponse.json({
      ok: true,
      job: "retry-cycle",
      ran_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      result: data
    });

  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      job: "retry-cycle",
      ran_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      error: "RETRY_CYCLE_CRON_FAILED",
      details: error.message || "unknown_error"
    }, { status: 500 });
  }
}