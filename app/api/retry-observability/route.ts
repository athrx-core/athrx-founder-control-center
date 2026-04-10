import { NextResponse } from "next/server";
import { getRetryObservability } from "@/app/lib/retry-observability";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await getRetryObservability();
    return NextResponse.json(result);
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