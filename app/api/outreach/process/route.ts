import { NextResponse } from 'next/server';
import { readJson } from '../../../../lib/http';
import { newLeadIds, startProcessing } from '../../../../lib/outreach/jobs';
import { fail, guarded } from '../../../../lib/outreach/route-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BATCH = 50;

/** Start finding LinkedIn profiles. Body: {ids: string[]} or {allNew: true}. */
export async function POST(request: Request) {
  return guarded(request, async () => {
    const body = await readJson(request);
    const ids = body.allNew === true
      ? await newLeadIds()
      : Array.isArray(body.ids)
        ? body.ids.filter((x): x is string => typeof x === 'string')
        : [];
    if (!ids.length) return fail('No leads to process.');
    const started = ids.slice(0, MAX_BATCH).filter((id) => startProcessing(id)).length;
    const extra = ids.length > MAX_BATCH ? ` Only the first ${MAX_BATCH} were started; run again for the rest.` : '';
    return NextResponse.json({ ok: true, started, message: `Started ${started} lead${started === 1 ? '' : 's'}.${extra}` });
  });
}
