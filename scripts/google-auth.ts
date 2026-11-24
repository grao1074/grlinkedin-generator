/**
 * One-time Google sign-in for the Outreach feature.
 *
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... bun run google:auth
 *
 * (or put both in .env.local first; Bun loads it automatically)
 *
 * Opens Google's consent page for two scopes only: edit spreadsheets and send
 * email. It cannot read your inbox. It prints a refresh token for .env.local.
 */
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

const PORT = 53682;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/gmail.send'];

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local first (see README, "Connect Google").');
  process.exit(1);
}

const state = randomBytes(16).toString('hex');
const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', REDIRECT);
  if (url.pathname !== '/callback') {
    res.writeHead(404).end();
    return;
  }
  const finish = (status: number, text: string) => {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }).end(text);
    server.close();
  };
  if (url.searchParams.get('state') !== state) return finish(400, 'State mismatch. Run the script again.');
  const code = url.searchParams.get('code');
  if (!code) return finish(400, `Google did not return a code (${url.searchParams.get('error') ?? 'unknown error'}).`);

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT,
      grant_type: 'authorization_code',
    }),
  });
  const body = (await tokenRes.json()) as { refresh_token?: string; error?: string };
  if (!body.refresh_token) {
    finish(500, 'No refresh token returned. Check the terminal.');
    console.error(`\nGoogle returned no refresh token (${body.error ?? `HTTP ${tokenRes.status}`}).`);
    console.error('Remove this app at https://myaccount.google.com/permissions and run the script again.');
    process.exitCode = 1;
    return;
  }
  finish(200, 'Done. You can close this tab and go back to the terminal.');
  console.log('\nAdd this line to .env.local (keep it private):\n');
  console.log(`GOOGLE_REFRESH_TOKEN=${body.refresh_token}\n`);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Open this link in your browser and allow access:\n');
  console.log(`${authUrl}\n`);
  console.log('Waiting for Google to redirect back…');
});
