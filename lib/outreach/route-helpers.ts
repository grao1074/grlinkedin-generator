import { NextResponse } from 'next/server';
import type { OutreachError } from '../../types/outreach';
import { AiError } from '../ai';
import { rejectCrossSite } from '../http';
import { ApifyError } from './apify';
import { GoogleError } from './google';

export function fail(message: string, status = 400) {
  return NextResponse.json<OutreachError>({ ok: false, message }, { status });
}

/**
 * Wraps an outreach route: refuses cross-site requests and turns known
 * service errors into readable messages without leaking response bodies.
 */
export async function guarded(request: Request, fn: () => Promise<Response>): Promise<Response> {
  const refused = rejectCrossSite(request);
  if (refused) return refused;
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ApifyError || error instanceof GoogleError || error instanceof AiError) {
      return fail(error.message, 502);
    }
    console.error('[outreach]', error);
    return fail(error instanceof Error ? error.message.slice(0, 300) : 'Unexpected server error.', 500);
  }
}

export const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
