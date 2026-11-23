# GR LinkedIn Assistant

A local dashboard that looks at the LinkedIn page you have open and suggests what to do: people worth connecting with, whether a post is worth a reply (with a draft comment), and whether to connect with a profile (with a draft note). It also has an **Outreach** page for researching leads and sending reviewed emails (see below).

It reads your screen through [Screenpipe](https://github.com/mediar-ai/screenpipe), which records locally, and sends the page text to an AI model you choose. The default is a local Ollama model, so nothing leaves your computer.

## What it will not do

It never clicks, likes, comments, connects or sends messages. You read the suggestion, edit the draft, and act yourself. Automating those actions is against LinkedIn's User Agreement and can get an account restricted.

## Setup

1. Install and start the Screenpipe app. It serves a local API on port 3030.
2. Install an AI model. For local use, install [Ollama](https://ollama.com) and run `ollama pull llama3.2`.
3. In this folder:

```bash
bun install
cp .env.example .env.local   # edit if you use a different model or a hosted API
bun dev                      # open http://127.0.0.1:3000
```

Open a LinkedIn people search, your feed, or a profile in your browser, then press **Analyse current page** on the dashboard. **Auto mode** re-checks every 60 seconds while the dashboard tab is open.

## Settings (`.env.local`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_BASE_URL` | `http://localhost:11434/v1` | Any OpenAI-compatible API base URL |
| `AI_MODEL` | `llama3.2` | Model name |
| `AI_API_KEY` | empty | Only for hosted APIs |
| `SCREENPIPE_URL` | `http://localhost:3030` | Screenpipe's local API |

`.env.local` is ignored by git, so keys stay out of the repository.

## Safety and privacy

- The server only listens on `127.0.0.1`, so other devices on your network cannot use it.
- The analyse endpoint refuses requests from other websites and allows one analysis every 30 seconds.
- Page text is passed to the AI as fenced, untrusted data, so text on a LinkedIn page cannot rewrite the instructions. Replies are type-checked and length-capped before display.
- Only captures from `linkedin.com` are used; other windows are ignored.
- This app must run on the same computer as Screenpipe. Hosting it online (Netlify, Vercel) will not work, because a hosted server cannot reach Screenpipe on your machine.

## Outreach (lead research and email)

The **Outreach** page replaces the old n8n "LinkedIn lead enrichment" workflow. It reads leads from your Google Sheet, finds each person's LinkedIn profile and company through Apify, has the AI draft a short personal email, and sends **only the emails you approve** from your Gmail.

How it differs from the n8n version:

- **Nothing sends automatically.** Every draft waits on the Review tab. You edit, approve, rewrite or skip it.
- **No guessing the person.** Search results are scored on name (60%) and company (40%). A profile is picked for you only when one candidate clearly matches. Otherwise you choose from the top three or paste the right URL.
- **Facts to check.** The AI must list every fact it used and where it came from, shown next to the draft.
- **Plain text, with an opt-out line** and your signature added to every email. Opt-outs go on a do-not-contact list that is never emailed again.
- **The sheet is updated** (Imported, Drafted, Sent, Skipped), and emails are de-duplicated, so a re-run never emails someone twice.
- **Daily send cap** and a pause between sends.
- **Profiles are cached**, so the same person is never paid for twice on Apify.
- **CSV export** of every lead, status and email.

### Try it with made-up data

```bash
bun run demo     # open http://127.0.0.1:3000/outreach
```

Demo mode uses fake leads, profiles and drafts and sends nothing.

### Set it up for real

1. **Apify.** Create a token at console.apify.com (Settings → Integrations) and set `APIFY_TOKEN`. Each new lead uses up to four actor runs: a person search, the profile, and sometimes a company search, then the company. The actors are the same ones the n8n workflow used (`apify/rag-web-browser`, `apimaestro/linkedin-profile-detail`, `apimaestro/linkedin-company-detail`).
2. **Connect Google.** In Google Cloud Console, create a project and enable the **Google Sheets API** and the **Gmail API**. Then create an OAuth client of type **Desktop app**. If the consent screen is in testing mode, add your own Google account as a test user. Put the client ID and secret in `.env.local`, run `bun run google:auth`, open the link it prints, and paste the `GOOGLE_REFRESH_TOKEN` line it gives back into `.env.local`. The only scopes it asks for are editing spreadsheets and sending mail. It cannot read your inbox.
3. **Sheet.** Set `SHEET_ID` (the long ID in the sheet's URL) and `SHEET_TAB`. The tab needs the columns `First Name`, `Last Name`, `Company` and `Email`. The app adds `Status`, `LinkedIn URL` and `Sent At` itself. Rows with an empty Status (or `New`) get imported.
4. **AI model.** It uses the same `AI_*` settings as the assistant. A small local model works, but a larger hosted model writes noticeably better emails. Any OpenAI-compatible host works, such as OpenRouter.
5. Run `bun dev`, open **Outreach → Settings** and fill in who you are, what you're asking for, and your call to action. Drafts are blocked until these are filled in, so the AI never makes up an offer.

### Things to know

- Lead data, drafts and cached profiles are stored in `data/outreach.json` on this computer. That folder is ignored by git.
- Profiles are collected from public LinkedIn pages by third-party Apify actors. LinkedIn's User Agreement restricts scraping, so this part is at your own risk. Keep the volumes small.
- Cold email laws differ by country (CAN-SPAM in the US, PECR and GDPR in the UK and EU). The app always adds an opt-out line and supports a postal address, but whether you can email a given person is up to you.
- Background jobs run inside the local server. If you stop `bun dev` mid-batch, those leads stay in a "working" state. Use **Retry** on them after you restart.

## Development

```bash
bun test            # unit tests for parsing and safety checks
bun run type-check
bun run lint
bun run build
```

Code layout: `app/page.tsx` (assistant dashboard), `app/api/analyze/route.ts`, `lib/linkedin.ts` (prompts and reply validation), `lib/screenpipe.ts` and `lib/ai.ts` (clients).

Outreach: `app/outreach/` (page and tabs), `app/api/outreach/` (routes), `lib/outreach/` (`match.ts` scoring, `email.ts` prompt and validation, `apify.ts`, `google.ts`, `mime.ts`, `store.ts`, `jobs.ts` pipeline, `mock.ts` demo data).
