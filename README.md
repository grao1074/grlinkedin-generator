# GR LinkedIn Assistant

A local dashboard that looks at the LinkedIn page you have open and suggests what to do: people worth connecting with, whether a post is worth a reply (with a draft comment), and whether to connect with a profile (with a draft note).

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

## Development

```bash
bun test            # unit tests for parsing and safety checks
bun run type-check
bun run lint
bun run build
```

Code layout: `app/page.tsx` (dashboard), `app/api/analyze/route.ts` (the one server endpoint), `lib/linkedin.ts` (prompts and reply validation), `lib/screenpipe.ts` and `lib/ai.ts` (clients).
