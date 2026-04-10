import { NextResponse } from "next/server";

export async function GET() {
  try {
    // هنا المنطق الحقيقي (لاحقًا نربطه Supabase)
    return NextResponse.json({
      ok: true,
      source: "core",
      job: "retry-observability",
      message: "core endpoint running"
    });
  } catch (error: any) {
    return NextResponse.json({
      ok: false,
      error: "CORE_RETRY_OBSERVABILITY_FAILED",
      details: error.message || "unknown_error"
    }, { status: 500 });
  }
}