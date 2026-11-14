import { NextResponse } from 'next/server';
import { buildMessages, detectPageType, parseResult } from '../../../lib/linkedin';
import { latestLinkedInCapture, ScreenpipeUnreachableError } from '../../../lib/screenpipe';
import { AiError, chat } from '../../../lib/ai';
import { RATE_LIMIT_MS, type AnalyzeError, type AnalyzeResponse } from '../../../types/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Shared across requests in this server process.
let lastRun = 0;

function fail(code: AnalyzeError['code'], message: string, status: number) {
  return NextResponse.json<AnalyzeError>({ ok: false, code, message }, { status });
}

/**
 * Reads what is on your LinkedIn tab right now (via Screenpipe) and returns
 * suggestions. It is read-only: it never clicks, likes, comments or sends
 * anything on LinkedIn.
 */
export async function POST(request: Request) {
  // Only answer requests from this dashboard, so another website open in
  // your browser cannot trigger analyses of your screen.
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin && host && new URL(origin).host !== host) {
    return fail('forbidden', 'Cross-site request refused.', 403);
  }

  const now = Date.now();
  const wait = lastRun + RATE_LIMIT_MS - now;
  if (wait > 0) {
    return fail('rate-limited', `Please wait ${Math.ceil(wait / 1000)} s before the next analysis.`, 429);
  }
  lastRun = now;

  let capture;
  try {
    capture = await latestLinkedInCapture();
  } catch (error) {
    if (error instanceof ScreenpipeUnreachableError) {
      return fail('screenpipe-unreachable', error.message, 503);
    }
    throw error;
  }
  if (!capture) {
    return fail('no-linkedin', 'No LinkedIn page seen on screen in the last 2 minutes.', 404);
  }

  const pageType = detectPageType(capture.url);
  if (pageType === 'other') {
    return fail(
      'unsupported-page',
      'Open a LinkedIn people search, your feed, or a profile page to get suggestions.',
      422
    );
  }

  let reply: string;
  try {
    reply = await chat(buildMessages(pageType, capture.text));
  } catch (error) {
    if (error instanceof AiError) return fail('ai-error', error.message, 502);
    throw error;
  }

  try {
    const result = parseResult(pageType, reply);
    return NextResponse.json<AnalyzeResponse>({
      ok: true,
      url: capture.url,
      capturedAt: capture.timestamp,
      result,
    });
  } catch {
    return fail('bad-ai-output', 'The AI reply was not in the expected format. Try again or use a larger model.', 502);
  }
}
