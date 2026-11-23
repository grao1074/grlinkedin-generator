'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { composeBody } from '../../lib/outreach/email';
import type { Lead, Settings } from '../../types/outreach';
import { Button, Card, Empty, StatusBadge } from './ui';

export function SendTab({
  leads,
  settings,
  sentToday,
  dailySendCap,
  mock,
  onSend,
  onOpen,
}: {
  leads: Lead[];
  settings: Settings | null;
  sentToday: number;
  dailySendCap: number;
  mock: boolean;
  onSend: (ids: string[]) => Promise<boolean>;
  onOpen: (id: string) => void;
}) {
  const approved = useMemo(() => leads.filter((l) => l.status === 'approved'), [leads]);
  const inFlight = leads.filter((l) => l.status === 'sending');
  const recent = useMemo(
    () => leads.filter((l) => l.status === 'sent').sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? '')).slice(0, 10),
    [leads]
  );
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // New approvals are ticked by default; ones that left the list are dropped.
  const approvedKey = approved.map((l) => l.id).join(',');
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    setPicked((prev) => {
      const next = new Set<string>();
      approved.forEach((l) => {
        if (prev.has(l.id) || !seen.current.has(l.id)) next.add(l.id);
        seen.current.add(l.id);
      });
      return next;
    });
  }, [approvedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const remaining = Math.max(0, dailySendCap - sentToday);
  const chosen = approved.filter((l) => picked.has(l.id)).map((l) => l.id);
  const willSend = Math.min(chosen.length, remaining);
  const delay = settings?.sendDelaySeconds ?? 0;

  const send = async () => {
    const minutes = Math.ceil(((willSend - 1) * delay) / 60);
    const msg = `${mock ? '[Demo mode: nothing really goes out]\n\n' : ''}Send ${willSend} email${willSend === 1 ? '' : 's'} from your Gmail now?${
      willSend > 1 && delay ? `\n\nThey go one at a time, ${delay} s apart (about ${minutes} min).` : ''
    }`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    await onSend(chosen);
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-gray-900">Ready to send</h2>
            <p className="text-sm text-gray-600">
              {sentToday} of {dailySendCap} sent today. {remaining} left under your daily cap.
            </p>
          </div>
          <Button variant="primary" onClick={send} disabled={busy || willSend === 0 || inFlight.length > 0}>
            {inFlight.length > 0 ? 'Sending…' : `Send ${willSend} approved`}
          </Button>
        </div>
        {chosen.length > remaining && (
          <p className="text-xs text-amber-700 mt-2">
            {chosen.length - remaining} will wait until tomorrow because of the daily cap (change it in Settings).
          </p>
        )}
        {!settings?.senderEmail && (
          <p className="text-xs text-amber-700 mt-2">
            Tip: add your Gmail address in Settings so the email shows your name as the sender.
          </p>
        )}
      </Card>

      <Card>
        {approved.length === 0 && inFlight.length === 0 ? (
          <Empty title="Nothing approved yet">Approve drafts on the Review tab and they will wait here.</Empty>
        ) : (
          <ul className="divide-y divide-gray-100">
            {[...inFlight, ...approved].map((l) => (
              <li key={l.id} className="p-4 sm:px-6 flex gap-3 items-start">
                <input
                  type="checkbox"
                  className="mt-1.5 w-4 h-4"
                  aria-label={`Send to ${l.firstName} ${l.lastName}`}
                  disabled={l.status !== 'approved'}
                  checked={picked.has(l.id)}
                  onChange={(e) =>
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(l.id);
                      else next.delete(l.id);
                      return next;
                    })
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <p className="font-medium text-gray-900">
                      {l.firstName} {l.lastName} <span className="font-normal text-gray-500 text-sm break-all">· {l.email}</span>
                    </p>
                    <StatusBadge status={l.status} />
                  </div>
                  <p className="text-sm text-gray-800 mt-1">{l.draft?.subject}</p>
                  {l.error && <p className="text-xs text-red-600 mt-1">{l.error}</p>}
                  <details className="mt-1">
                    <summary className="text-xs text-blue-700 cursor-pointer">Preview</summary>
                    <pre className="mt-2 whitespace-pre-wrap font-[inherit] text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3">
                      {settings && l.draft ? composeBody(l.draft, settings) : l.draft?.body}
                    </pre>
                  </details>
                </div>
                <Button small variant="ghost" onClick={() => onOpen(l.id)}>
                  Edit
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {recent.length > 0 && (
        <Card className="p-4 sm:p-6">
          <h2 className="font-semibold text-gray-900 mb-3">Recently sent</h2>
          <ul className="space-y-2 text-sm">
            {recent.map((l) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-2">
                <span className="text-gray-800">
                  {l.firstName} {l.lastName} · {l.draft?.subject}
                </span>
                <span className="text-xs text-gray-500">{l.sentAt && new Date(l.sentAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
