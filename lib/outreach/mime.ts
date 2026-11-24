/**
 * Builds a plain-text RFC 2822 email for the Gmail API. Header values are
 * stripped of line breaks so a subject or name cannot inject extra headers.
 */

export function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

/** RFC 2047 encode a header value if it has non-ASCII characters. */
export function encodeHeader(value: string): string {
  const safe = headerSafe(value);
  if (/^[\x00-\x7F]*$/.test(safe)) return safe;
  return `=?UTF-8?B?${Buffer.from(safe, 'utf8').toString('base64')}?=`;
}

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

function address(name: string, email: string): string {
  const e = headerSafe(email);
  const n = headerSafe(name).replace(/"/g, "'");
  if (!n) return e;
  const encoded = encodeHeader(n);
  return `${encoded === n ? `"${n}"` : encoded} <${e}>`;
}

export interface MimeInput {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
}

export function buildMime(input: MimeInput): string {
  if (!isValidEmail(input.to)) throw new Error('Invalid recipient address');
  const headers: string[] = [];
  if (input.fromEmail && isValidEmail(input.fromEmail)) headers.push(`From: ${address(input.fromName ?? '', input.fromEmail)}`);
  headers.push(`To: ${headerSafe(input.to)}`);
  if (input.replyTo && isValidEmail(input.replyTo)) {
    headers.push(`Reply-To: ${headerSafe(input.replyTo)}`);
    headers.push(`List-Unsubscribe: <mailto:${headerSafe(input.replyTo)}?subject=unsubscribe>`);
  }
  headers.push(`Subject: ${encodeHeader(input.subject)}`);
  headers.push('MIME-Version: 1.0');
  headers.push('Content-Type: text/plain; charset="UTF-8"');
  headers.push('Content-Transfer-Encoding: base64');

  const body = Buffer.from(input.body.replace(/\r?\n/g, '\r\n'), 'utf8')
    .toString('base64')
    .replace(/.{76}/g, '$&\r\n');
  return `${headers.join('\r\n')}\r\n\r\n${body}`;
}

/** base64url, as the Gmail API expects for the raw message. */
export function toBase64Url(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
