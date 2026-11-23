import { NextResponse } from 'next/server';
import { readJson } from '../../../../../../lib/http';
import { chooseProfile } from '../../../../../../lib/outreach/jobs';
import { fail, guarded, str } from '../../../../../../lib/outreach/route-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** You chose the right LinkedIn profile. Body: {url}. Starts fetching details and drafting. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return guarded(request, async () => {
    const { id } = await params;
    const body = await readJson(request);
    const result = await chooseProfile(id, str(body.url, 500));
    if (!result.ok) return fail(result.message ?? 'Could not use that profile.');
    return NextResponse.json({ ok: true });
  });
}
