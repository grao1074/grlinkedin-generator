'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { Settings } from '../../types/outreach';
import { Button, Card } from './ui';

function Field({
  label,
  hint,
  required,
  children,
  id,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  id: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-800">
        {label} {required && <span className="text-red-600" aria-hidden>*</span>}
      </label>
      {hint && <p className="text-xs text-gray-500 mb-1">{hint}</p>}
      {children}
    </div>
  );
}

const input = 'w-full text-sm px-3 py-2 border border-gray-300 rounded-lg';

export function SettingsTab({
  settings,
  suppression,
  onSave,
}: {
  settings: Settings | null;
  suppression: string[];
  onSave: (settings: Settings, suppression: string[]) => Promise<boolean>;
}) {
  const [form, setForm] = useState<Settings | null>(settings);
  const [blocked, setBlocked] = useState(suppression.join('\n'));
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(settings), [settings]);
  useEffect(() => setBlocked(suppression.join('\n')), [suppression]);

  if (!form) return <Card className="p-6 text-sm text-gray-500">Loading settings…</Card>;

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const text = (key: keyof Settings, rows?: number, placeholder?: string, maxLength = 2000) =>
    rows ? (
      <textarea
        id={key}
        rows={rows}
        maxLength={maxLength}
        className={input}
        placeholder={placeholder}
        value={String(form[key])}
        onChange={(e) => set(key, e.target.value as never)}
      />
    ) : (
      <input
        id={key}
        maxLength={maxLength}
        className={input}
        placeholder={placeholder}
        value={String(form[key])}
        onChange={(e) => set(key, e.target.value as never)}
      />
    );

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        const list = blocked
          .split(/[\s,;]+/)
          .map((x) => x.trim())
          .filter(Boolean);
        await onSave(form, list);
        setSaving(false);
      }}
    >
      <Card className="p-4 sm:p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">You and your ask</h2>
          <p className="text-sm text-gray-600">The AI writes every email from these. Fields marked * are needed before drafting.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field id="senderName" label="Your name" required>
            {text('senderName', undefined, 'Girish', 100)}
          </Field>
          <Field id="senderEmail" label="Your Gmail address" hint="Shown as the sender">
            {text('senderEmail', undefined, 'you@gmail.com', 200)}
          </Field>
          <Field id="replyTo" label="Reply-to address" hint="Optional">
            {text('replyTo', undefined, 'Same as Gmail if empty', 200)}
          </Field>
        </div>
        <Field id="about" label="About you" required hint="Who you are and what you make, in your own words.">
          {text('about', 4, 'e.g. I make videos and posts about AI in healthcare, mostly geriatric psychiatry, for clinicians, researchers and caregivers.')}
        </Field>
        <Field id="offer" label="What you are asking for or offering" required hint="Be specific. The AI will not invent an offer.">
          {text('offer', 3, 'e.g. I would like to interview you for a 20-minute YouTube episode about your dementia screening work.')}
        </Field>
        <Field id="callToAction" label="Call to action" required hint="The one thing the reader should do.">
          {text('callToAction', undefined, 'e.g. Reply to this email if you are open to a short call next week.', 500)}
        </Field>
        <Field id="tone" label="Tone">
          {text('tone', 2, undefined, 500)}
        </Field>
        <Field id="signature" label="Signature" hint="Added under every email.">
          {text('signature', 3, 'Girish\nYouTube: …', 500)}
        </Field>
      </Card>

      <Card className="p-4 sm:p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">Compliance and limits</h2>
          <p className="text-sm text-gray-600">
            Cold email laws (CAN-SPAM in the US, PECR and GDPR in the UK and EU) expect a clear way to opt out. The US also
            expects a postal address.
          </p>
        </div>
        <Field id="optOutText" label="Opt-out line" required>
          {text('optOutText', 2, undefined, 500)}
        </Field>
        <Field id="postalAddress" label="Postal address" hint="Optional, but expected for US recipients.">
          {text('postalAddress', undefined, undefined, 300)}
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field id="dailySendCap" label="Daily send cap" hint="1 to 200">
            <input
              id="dailySendCap"
              type="number"
              min={1}
              max={200}
              className={input}
              value={form.dailySendCap}
              onChange={(e) => set('dailySendCap', Number(e.target.value))}
            />
          </Field>
          <Field id="sendDelaySeconds" label="Seconds between sends" hint="Spacing looks less like bulk mail">
            <input
              id="sendDelaySeconds"
              type="number"
              min={0}
              max={600}
              className={input}
              value={form.sendDelaySeconds}
              onChange={(e) => set('sendDelaySeconds', Number(e.target.value))}
            />
          </Field>
          <Field id="matchThreshold" label="Auto-match threshold" hint="Lower picks more profiles without asking you">
            <select
              id="matchThreshold"
              className={input}
              value={form.matchThreshold}
              onChange={(e) => set('matchThreshold', Number(e.target.value))}
            >
              <option value={1}>100%: always ask unless perfect</option>
              <option value={0.9}>90%</option>
              <option value={0.8}>80% (recommended)</option>
              <option value={0.7}>70%</option>
              <option value={0.6}>60%: name match alone is enough</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card className="p-4 sm:p-6 space-y-2">
        <h2 className="font-semibold text-gray-900">Do-not-contact list</h2>
        <p className="text-sm text-gray-600">
          One email per line. These people are never imported, drafted or emailed. Add anyone who asks to opt out.
        </p>
        <label htmlFor="suppression" className="sr-only">
          Do-not-contact emails
        </label>
        <textarea id="suppression" rows={5} className={`${input} font-mono`} value={blocked} onChange={(e) => setBlocked(e.target.value)} />
      </Card>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </form>
  );
}
