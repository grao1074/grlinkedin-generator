/**
 * Calls any OpenAI-compatible chat completions API. The default is a local
 * Ollama server, so nothing leaves your computer unless you point it
 * elsewhere in .env.local.
 */
const AI_BASE_URL = (process.env.AI_BASE_URL || 'http://localhost:11434/v1').replace(/\/+$/, '');
const AI_MODEL = process.env.AI_MODEL || 'llama3.2';
const AI_API_KEY = process.env.AI_API_KEY || '';

export class AiError extends Error {}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function chat(messages: ChatMessage[]): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(AI_API_KEY ? { Authorization: `Bearer ${AI_API_KEY}` } : {}),
      },
      body: JSON.stringify({ model: AI_MODEL, messages, temperature: 0.2 }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new AiError(`Could not reach the AI service at ${AI_BASE_URL}. Check AI_BASE_URL in .env.local.`);
  }

  if (!res.ok) {
    // Do not echo the response body: it can contain request details.
    throw new AiError(`The AI service returned HTTP ${res.status}. Check AI_MODEL and AI_API_KEY.`);
  }

  const body = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new AiError('The AI service returned an empty reply.');
  }
  return content;
}
