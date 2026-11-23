import { NextResponse } from 'next/server';

/**
 * Returns a 403 response when a request comes from another website, so a
 * page open in your browser cannot drive this local server. Returns null
 * when the request is from this dashboard (or has no Origin, e.g. a direct
 * link or curl on this machine).
 */
export function rejectCrossSite(request: Request): NextResponse | null {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return null;
  try {
    if (new URL(origin).host === host) return null;
  } catch {
    /* malformed Origin: refuse below */
  }
  return NextResponse.json({ ok: false, code: 'forbidden', message: 'Cross-site request refused.' }, { status: 403 });
}

/** Read a JSON body, returning {} when it is missing or invalid. */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
