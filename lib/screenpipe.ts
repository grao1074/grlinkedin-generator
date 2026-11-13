import { isLinkedInUrl } from './linkedin';

/**
 * Minimal client for Screenpipe's local search API (the same endpoint the
 * official @screenpipe/js SDK calls). Calling it directly avoids pulling in
 * the SDK's analytics and server dependencies.
 */
const SCREENPIPE_URL = (process.env.SCREENPIPE_URL || 'http://localhost:3030').replace(/\/+$/, '');

export interface ScreenCapture {
  text: string;
  url: string;
  timestamp: string;
}

export class ScreenpipeUnreachableError extends Error {}

interface RawItem {
  type?: string;
  content?: Record<string, unknown>;
}

function str(obj: Record<string, unknown> | undefined, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === 'string' && v) return v;
  }
  return '';
}

/**
 * Returns the most recent screen capture from a LinkedIn browser tab within
 * the last `windowMs`, or null if there is none.
 */
export async function latestLinkedInCapture(windowMs = 2 * 60_000): Promise<ScreenCapture | null> {
  const params = new URLSearchParams({
    content_type: 'ocr',
    limit: '30',
    start_time: new Date(Date.now() - windowMs).toISOString(),
  });

  let res: Response;
  try {
    res = await fetch(`${SCREENPIPE_URL}/search?${params}`, {
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
  } catch {
    throw new ScreenpipeUnreachableError(
      `Could not reach Screenpipe at ${SCREENPIPE_URL}. Is the Screenpipe app running?`
    );
  }
  if (!res.ok) {
    throw new ScreenpipeUnreachableError(`Screenpipe returned HTTP ${res.status}.`);
  }

  const body = (await res.json()) as { data?: RawItem[] };
  const captures = (body.data ?? [])
    .map((item) => {
      const c = item.content;
      return {
        text: str(c, 'text'),
        // The raw API uses snake_case; accept camelCase too.
        url: str(c, 'browser_url', 'browserUrl'),
        timestamp: str(c, 'timestamp'),
      };
    })
    .filter((c) => c.text && isLinkedInUrl(c.url));

  if (captures.length === 0) return null;
  captures.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  return captures[0];
}
