import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const start = Date.now();

  try {
    const baseUrl = new URL(request.url).origin;

    const res = await fetch(`${baseUrl}/api/failure-observability`, {
      method: "GET"
    });

    const data = await res.json();

    return NextResponse.json({
      ok: true,
      job: "failure-observability",
      ran_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      result: data
    });

  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      job: "failure-observability",
      ran_at: new Date().toISOString(),
      duration_ms: Date.now() - start,
      error: "FAILURE_OBSERVABILITY_CRON_FAILED",
      details: error.message || "unknown_error"
    }, { status: 500 });
  }
}