'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ACTIVE_STATUSES, type Lead, type Settings } from '../../types/outreach';
import { api, needsAttention } from './client';
import { LeadsTab } from './LeadsTab';
import { ReviewTab, type ReviewActions } from './ReviewTab';
import { SendTab } from './SendTab';
import { SettingsTab } from './SettingsTab';

type Tab = 'leads' | 'review' | 'send' | 'settings';
type Notice = { kind: 'info' | 'error' | 'success'; text: string } | null;

const FAST_POLL_MS = 2500;
const SLOW_POLL_MS = 15000;

const TAB_KEY = 'linkedin-assistant-outreach-tab';

export default function OutreachPage() {
  const [tab, setTab] = useState<Tab>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [meta, setMeta] = useState({ sentToday: 0, dailySendCap: 20, suppressedCount: 0, mock: false });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [suppression, setSuppression] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback((n: Notice) => {
    setNotice(n);
    clearTimeout(noticeTimer.current);
    if (n && n.kind !== 'error') noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await api.leads();
      setLeads(r.leads);
      setMeta({ sentToday: r.sentToday, dailySendCap: r.dailySendCap, suppressedCount: r.suppressedCount, mock: r.mock });
      setLoaded(true);
    } catch (e) {
      show({ kind: 'error', text: (e as Error).message });
    }
  }, [show]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY) as Tab | null;
      if (saved && ['leads', 'review', 'send', 'settings'].includes(saved)) setTab(saved);
    } catch {
      /* storage blocked */
    }
    void refresh();
    api
      .settings()
      .then((r) => {
        setSettings(r.settings);
        setSuppression(r.suppression);
      })
      .catch((e: Error) => show({ kind: 'error', text: e.message }));
  }, [refresh, show]);

  const working = leads.some((l) => ACTIVE_STATUSES.includes(l.status));

  // Poll quickly while background work runs, slowly otherwise, and only while visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, working ? FAST_POLL_MS : SLOW_POLL_MS);
    return () => clearInterval(id);
  }, [working, refresh]);

  const goTo = useCallback((t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const open = useCallback(
    (id: string) => {
      setSelectedId(id);
      goTo('review');
    },
    [goTo]
  );

  /** Run an API call, show its message or error, refresh. Returns success. */
  const run = useCallback(
    async (fn: () => Promise<{ message?: string } | object>, success?: string): Promise<boolean> => {
      setBusy(true);
      try {
        const r = (await fn()) as { message?: string };
        const text = r.message ?? success;
        if (text) show({ kind: 'success', text });
        return true;
      } catch (e) {
        show({ kind: 'error', text: (e as Error).message });
        return false;
      } finally {
        setBusy(false);
        void refresh();
      }
    },
    [refresh, show]
  );

  const reviewActions: ReviewActions = useMemo(
    () => ({
      chooseMatch: (id, url) => run(() => api.chooseMatch(id, url), 'Got it. Fetching their details and writing a draft.'),
      redraft: (id, note) => run(() => api.redraft(id, note), 'Writing a new draft…'),
      action: (id, action, extra) => {
        const messages: Record<string, string> = {
          save: 'Edits saved.',
          approve: 'Approved. It is waiting on the Send tab.',
          unapprove: 'Moved back to draft.',
          skip: 'Lead skipped.',
          'do-not-contact': 'Added to the do-not-contact list.',
          retry: 'Trying again…',
        };
        return run(() => api.action(id, action, extra), messages[action]);
      },
      goToSettings: () => goTo('settings'),
    }),
    [run, goTo]
  );

  const counts = useMemo(
    () => ({
      new: leads.filter((l) => l.status === 'new').length,
      review: leads.filter(needsAttention).length,
      approved: leads.filter((l) => l.status === 'approved').length,
      sent: leads.filter((l) => l.status === 'sent').length,
    }),
    [leads]
  );

  const settingsIncomplete = settings && (!settings.senderName || !settings.about || !settings.offer || !settings.callToAction);

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: 'leads', label: 'Leads', badge: leads.length },
    { id: 'review', label: 'Review', badge: counts.review },
    { id: 'send', label: 'Send', badge: counts.approved },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-4">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Outreach</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Find each lead on LinkedIn, draft a personal email, and send only what you approve.
            </p>
          </div>
          {working && (
            <p className="text-sm text-blue-700 flex items-center gap-2" aria-live="polite">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" aria-hidden /> Working in the background
            </p>
          )}
        </header>

        {meta.mock && (
          <div className="px-4 py-2 rounded-lg bg-purple-50 border border-purple-200 text-sm text-purple-900">
            <strong>Demo mode.</strong> Leads, profiles and drafts are made up, and no email is really sent. Remove
            OUTREACH_MOCK from .env.local to use your real accounts.
          </div>
        )}

        {settingsIncomplete && tab !== 'settings' && (
          <div className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2">
            <span>Fill in your Settings (name, about you, your ask, call to action) before drafts can be written.</span>
            <button type="button" className="font-medium underline" onClick={() => goTo('settings')}>
              Open Settings
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="New leads" value={counts.new} tone="gray" />
          <Stat label="Waiting for you" value={counts.review} tone="violet" onClick={() => goTo('review')} />
          <Stat label="Approved" value={counts.approved} tone="green" onClick={() => goTo('send')} />
          <Stat label="Sent today" value={`${meta.sentToday} / ${meta.dailySendCap}`} tone="blue" />
        </div>

        {notice && (
          <div
            role={notice.kind === 'error' ? 'alert' : 'status'}
            className={`px-4 py-3 rounded-lg border text-sm flex justify-between gap-3 ${
              notice.kind === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : notice.kind === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}
          >
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
              ✕
            </button>
          </div>
        )}

        <div className="border-b border-gray-200 flex gap-1 overflow-x-auto" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => goTo(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
                tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {t.label}
              {t.badge ? (
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-blue-100' : 'bg-gray-200'}`}>
                  {t.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {!loaded ? (
          <p className="text-sm text-gray-500 p-6">Loading…</p>
        ) : tab === 'leads' ? (
          <LeadsTab
            leads={leads}
            busy={busy}
            onImport={() => run(api.importSheet)}
            onProcessAllNew={() => run(api.processAllNew)}
            onProcessOne={(id) => run(() => api.process([id]))}
            onOpen={open}
          />
        ) : tab === 'review' ? (
          <ReviewTab leads={leads} selectedId={selectedId} onSelect={setSelectedId} settings={settings} actions={reviewActions} />
        ) : tab === 'send' ? (
          <SendTab
            leads={leads}
            settings={settings}
            sentToday={meta.sentToday}
            dailySendCap={meta.dailySendCap}
            mock={meta.mock}
            onSend={(ids) => run(() => api.send(ids))}
            onOpen={open}
          />
        ) : (
          <SettingsTab
            settings={settings}
            suppression={suppression}
            onSave={(s, list) =>
              run(async () => {
                const r = await api.saveSettings(s, list);
                setSettings(r.settings);
                setSuppression(r.suppression);
                return { message: 'Settings saved.' };
              })
            }
          />
        )}

        <footer className="text-xs text-gray-500 pt-4 space-y-1">
          <p>
            Lead data and drafts are stored only on this computer (data/outreach.json). Profiles come from public
            LinkedIn pages through Apify actors; using them is subject to LinkedIn&apos;s and Apify&apos;s terms.
          </p>
          <p>{meta.suppressedCount} address{meta.suppressedCount === 1 ? '' : 'es'} on the do-not-contact list.</p>
        </footer>
      </div>
    </main>
  );
}

const TONES = {
  gray: 'bg-white text-gray-900',
  violet: 'bg-violet-50 text-violet-900',
  green: 'bg-green-50 text-green-900',
  blue: 'bg-blue-50 text-blue-900',
};

function Stat({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number | string;
  tone: keyof typeof TONES;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="block text-xs font-medium opacity-80">{label}</span>
      <span className="block text-2xl font-bold mt-1 tabular-nums">{value}</span>
    </>
  );
  const cls = `rounded-lg border border-gray-200 p-4 text-left ${TONES[tone]}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} hover:ring-2 hover:ring-blue-200`}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
