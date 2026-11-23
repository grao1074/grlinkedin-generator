import { NextResponse } from 'next/server';
import { readJson } from '../../../../lib/http';
import { startSending } from '../../../../lib/outreach/jobs';
import { fail, guarded } from '../../../../lib/outreach/route-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Send approved emails. Body: {ids: string[]}. Every rule is re-checked per email on the server. */
export async function POST(request: Request) {
  return guarded(request, async () => {
    const body = await readJson(request);
    const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : [];
    if (!ids.length) return fail('Choose at least one approved email.');
    const result = await startSending(ids);
    if (!result.queued) return fail(result.message, 409);
    return NextResponse.json({ ok: true, ...result });
  });
}
