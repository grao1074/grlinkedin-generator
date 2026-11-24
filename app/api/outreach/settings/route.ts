import { NextResponse } from 'next/server';
import { readJson } from '../../../../lib/http';
import { fail, guarded } from '../../../../lib/outreach/route-helpers';
import { sanitizeSettings, sanitizeSuppression } from '../../../../lib/outreach/settings';
import { readState, updateState } from '../../../../lib/outreach/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return guarded(request, async () => {
    const { settings, suppression } = await readState();
    return NextResponse.json({ ok: true, settings, suppression });
  });
}

/** Body: {settings, suppression?: string[]} */
export async function PUT(request: Request) {
  return guarded(request, async () => {
    const body = await readJson(request);
    const input = body.settings && typeof body.settings === 'object' ? (body.settings as Record<string, unknown>) : {};
    const result = sanitizeSettings(input);
    if ('error' in result) return fail(result.error);
    const suppression = body.suppression === undefined ? undefined : sanitizeSuppression(body.suppression);
    await updateState((s) => {
      s.settings = result.settings;
      if (suppression) s.suppression = suppression;
    });
    const state = await readState();
    return NextResponse.json({ ok: true, settings: state.settings, suppression: state.suppression });
  });
}
