import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BetterStackIncidentPayload = {
  event?: string;
  incident_id?: string;
  name?: string;
  url?: string;
  http_method?: string;
  cause?: string;
  status?: string;
  started_at?: string;
  acknowledged_at?: string;
  resolved_at?: string;
  response_content?: string;
  response_url?: string;
  screenshot_url?: string;
};

type NormalizedIncident = {
  source: 'betterstack';
  event: string;
  incident_id: string;
  name: string | null;
  url: string | null;
  http_method: string | null;
  cause: string | null;
  status: string | null;
  started_at: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  response_content: string | null;
  response_url: string | null;
  screenshot_url: string | null;
  received_at: string;
  request_id: string;
  user_agent: string | null;
  ip_address: string | null;
};

function getClientIp(request: NextRequest): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || null;
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return null;
}

function getRequestId(request: NextRequest): string {
  return (
    request.headers.get('x-request-id') ||
    request.headers.get('x-vercel-id') ||
    crypto.randomUUID()
  );
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePayload(
  payload: BetterStackIncidentPayload,
  request: NextRequest
): NormalizedIncident {
  return {
    source: 'betterstack',
    event: asTrimmedString(payload.event) || 'unknown',
    incident_id: asTrimmedString(payload.incident_id) || 'unknown',
    name: asTrimmedString(payload.name),
    url: asTrimmedString(payload.url),
    http_method: asTrimmedString(payload.http_method),
    cause: asTrimmedString(payload.cause),
    status: asTrimmedString(payload.status),
    started_at: asTrimmedString(payload.started_at),
    acknowledged_at: asTrimmedString(payload.acknowledged_at),
    resolved_at: asTrimmedString(payload.resolved_at),
    response_content: asTrimmedString(payload.response_content),
    response_url: asTrimmedString(payload.response_url),
    screenshot_url: asTrimmedString(payload.screenshot_url),
    received_at: new Date().toISOString(),
    request_id: getRequestId(request),
    user_agent: request.headers.get('user-agent'),
    ip_address: getClientIp(request),
  };
}

function isPayloadShapeValid(payload: BetterStackIncidentPayload): boolean {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    Object.keys(payload).length > 0
  );
}

function buildSafeLogObject(incident: NormalizedIncident) {
  return {
    ...incident,
    response_content:
      incident.response_content && incident.response_content.length > 1000
        ? `${incident.response_content.slice(0, 1000)}...[truncated]`
        : incident.response_content,
  };
}

function isAuthorized(request: NextRequest): boolean {
  const configuredSecret = process.env.BETTERSTACK_WEBHOOK_SECRET?.trim();

  // يسمح مؤقتًا إذا لم يتم إعداد السر بعد، حتى لا يتعطل الربط الأولي.
  if (!configuredSecret) {
    return true;
  }

  const secretHeader =
    request.headers.get('x-athrx-webhook-secret')?.trim() ||
    request.headers.get('x-betterstack-secret')?.trim();

  if (secretHeader && secretHeader === configuredSecret) {
    return true;
  }

  const authHeader = request.headers.get('authorization')?.trim();
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token === configuredSecret) {
      return true;
    }
  }

  return false;
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    if (!isAuthorized(request)) {
      console.error('[ATHRX][BETTERSTACK_WEBHOOK][UNAUTHORIZED]', {
        request_id: requestId,
        ip_address: getClientIp(request),
        user_agent: request.headers.get('user-agent'),
      });

      return NextResponse.json(
        {
          ok: false,
          error: 'unauthorized',
          request_id: requestId,
        },
        { status: 401 }
      );
    }

    let body: BetterStackIncidentPayload;

    try {
      body = (await request.json()) as BetterStackIncidentPayload;
    } catch (error) {
      console.error('[ATHRX][BETTERSTACK_WEBHOOK][INVALID_JSON]', {
        request_id: requestId,
        error: error instanceof Error ? error.message : 'unknown_json_error',
      });

      return NextResponse.json(
        {
          ok: false,
          error: 'invalid_json',
          request_id: requestId,
        },
        { status: 400 }
      );
    }

    if (!isPayloadShapeValid(body)) {
      console.error('[ATHRX][BETTERSTACK_WEBHOOK][EMPTY_OR_INVALID_PAYLOAD]', {
        request_id: requestId,
        payload_type: typeof body,
      });

      return NextResponse.json(
        {
          ok: false,
          error: 'invalid_payload',
          request_id: requestId,
        },
        { status: 400 }
      );
    }

    const incident = normalizePayload(body, request);

    console.log(
      '[ATHRX][BETTERSTACK_WEBHOOK][RECEIVED]',
      JSON.stringify(buildSafeLogObject(incident))
    );

    // Placeholder للمرحلة التالية:
    // هنا سنضيف لاحقًا:
    // 1) database logging
    // 2) decision engine hook
    // 3) self-healing trigger
    // 4) founder control center event stream

    return NextResponse.json(
      {
        ok: true,
        accepted: true,
        source: 'betterstack',
        request_id: incident.request_id,
        event: incident.event,
        incident_id: incident.incident_id,
        received_at: incident.received_at,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[ATHRX][BETTERSTACK_WEBHOOK][FATAL]', {
      request_id: requestId,
      error: error instanceof Error ? error.message : 'unknown_fatal_error',
    });

    return NextResponse.json(
      {
        ok: false,
        error: 'internal_error',
        request_id: requestId,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      endpoint: '/api/athrx/incident',
      source: 'betterstack',
      method: 'POST',
      status: 'ready',
    },
    { status: 200 }
  );
}