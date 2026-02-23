import { CHAT_MODEL } from "@/lib/constants";
import { ChatMessage } from "@/lib/types";

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
}

export async function chatCompletionStream(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const { temperature = 0.3, maxTokens = 2048 } = options;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
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
