import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Demo mode with no delays, and a throwaway data folder.
const dir = mkdtempSync(path.join(tmpdir(), 'outreach-test-'));
process.env.OUTREACH_MOCK = '1';
process.env.OUTREACH_MOCK_DELAY_MS = '0';
process.env.OUTREACH_DATA_DIR = dir;

type Jobs = typeof import('./jobs');
type Store = typeof import('./store');
type Mock = typeof import('./mock');
let jobs: Jobs;
let store: Store;
let mock: Mock;

beforeAll(async () => {
  jobs = await import('./jobs');
  store = await import('./store');
  mock = await import('./mock');
  store.resetStoreCache();
  await store.updateState((s) => {
    Object.assign(s.settings, {
      senderName: 'Test Sender',
      about: 'I make videos about AI in geriatric psychiatry.',
      offer: 'A short interview.',
      callToAction: 'Reply if interested.',
      sendDelaySeconds: 0,
      dailySendCap: 2,
    });
  });
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function waitFor(check: (s: Awaited<ReturnType<Store['readState']>>) => boolean, ms = 3000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const s = await store.readState();
    if (check(s)) return s;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('Timed out waiting for state');
}

const byName = async (last: string) => (await store.readState()).leads.find((l) => l.lastName === last)!;

describe('outreach pipeline (demo data)', () => {
  test('import skips duplicates and rows without email, and marks the sheet', async () => {
    const summary = await jobs.importFromSheet();
    expect(summary).toEqual({ added: 3, duplicates: 1, suppressed: 0, invalid: 1, alreadyHandled: 0 });
    const again = await jobs.importFromSheet();
    expect(again.added).toBe(0);
    expect(mock.mockState().grid[0]).toContain('Status');
  });

  test('a clear match is enriched and drafted; an ambiguous one waits for you', async () => {
    for (const id of await jobs.newLeadIds()) jobs.startProcessing(id);
    await waitFor((s) => s.leads.every((l) => ['drafted', 'needs-match', 'failed'].includes(l.status)));

    const amara = await byName('Okafor');
    expect(amara.status).toBe('drafted');
    expect(amara.profileUrl).toBe('https://www.linkedin.com/in/amara-okafor-demo');
    expect(amara.companyInfo?.name).toBe('Northbridge Memory Clinic');
    expect(amara.draft?.factsUsed.length).toBeGreaterThan(0);

    const john = await byName('Smith');
    expect(john.status).toBe('needs-match');
    expect(john.candidates.length).toBe(3);
    expect(john.profileUrl).toBeUndefined();

    // Company found through the web-search fallback.
    const priya = await byName('Raman');
    expect(priya.status).toBe('drafted');
    expect(priya.companyUrl).toBe('https://www.linkedin.com/company/silverline-care-labs-demo');
  });

  test('choosing the right person continues the pipeline', async () => {
    const john = await byName('Smith');
    expect((await jobs.chooseProfile(john.id, 'not a url')).ok).toBe(false);
    expect((await jobs.chooseProfile(john.id, 'https://www.linkedin.com/in/john-smith-demo-3/')).ok).toBe(true);
    await waitFor((s) => s.leads.find((l) => l.id === john.id)?.status === 'drafted');
  });

  test('nothing is sent unless approved', async () => {
    const ids = (await store.readState()).leads.map((l) => l.id);
    const r = await jobs.startSending(ids);
    expect(r.queued).toBe(0);
    expect(mock.mockState().sent.length).toBe(0);
  });

  test('approved emails send, the daily cap holds, and suppressed addresses are blocked', async () => {
    const leads = (await store.readState()).leads;
    for (const l of leads) await store.updateLead(l.id, { status: 'approved' });
    const priya = leads.find((l) => l.lastName === 'Raman')!;
    await jobs.skipLead(priya.id, true);
    await store.updateLead(priya.id, { status: 'approved' }); // simulate a stale approval

    const r = await jobs.startSending(leads.map((l) => l.id));
    expect(r.queued).toBe(2); // cap is 2
    await waitFor(() => !jobs.isSending());

    const sent = mock.mockState().sent;
    expect(sent.length).toBe(2);
    expect(sent.map((s) => s.to)).not.toContain('priya@example.org');
    expect(sent[0].raw).toContain('Content-Type: text/plain');

    const after = await store.readState();
    expect(store.sentToday(after)).toBe(2);
    expect((await jobs.startSending(leads.map((l) => l.id))).queued).toBe(0);
    expect(mock.mockState().grid.some((row) => row.includes('Sent'))).toBe(true);
  });
});
