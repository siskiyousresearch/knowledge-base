import { CHAT_MODEL } from "@/lib/constants";
import { ChatMessage } from "@/lib/types";
import { getSetting } from "@/lib/settings";

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
}

async function getApiKey(): Promise<string> {
  const key = await getSetting("openrouter_api_key");
  if (!key) {
    throw new Error("OpenRouter API key not configured. Set it in Settings or .env.local.");
  }
  return key;
}

export async function chatCompletionStream(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const { temperature = 0.3, maxTokens = 2048 } = options;
  const apiKey = await getApiKey();

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000",
      "X-Title": "Knowledge Base RAG",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} — ${errorText}`);
  }

  return response.body!;
}
