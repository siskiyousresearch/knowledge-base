import { ChatMessage } from "@/lib/types";
import { getSetting } from "@/lib/settings";
import { DEFAULT_MODEL_ID } from "@/lib/ai/models";

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

interface ProviderConfig {
  baseUrl: string;
  model: string;
  headers: Record<string, string>;
  isLocal: boolean;
}

async function getProviderConfig(optionsModel?: string): Promise<ProviderConfig> {
  const aiMode = (await getSetting("ai_mode")) || "cloud";

  if (aiMode === "local") {
    const localUrl = await getSetting("local_ai_url");
    const localModel = await getSetting("local_ai_model");

    if (!localUrl) {
      throw new Error("Local AI URL not configured. Set it in Settings or .env.local.");
    }
    if (!localModel) {
      throw new Error("Local AI model not configured. Set it in Settings or .env.local.");
    }

    return {
      baseUrl: localUrl,
      model: localModel,
      headers: { "Content-Type": "application/json" },
      isLocal: true,
    };
  }

  // Cloud mode (default)
  const apiKey = await getSetting("openrouter_api_key");
  if (!apiKey) {
    throw new Error("OpenRouter API key not configured. Set it in Settings or .env.local.");
  }

  return {
    baseUrl: "https://openrouter.ai/api/v1",
    model: optionsModel || DEFAULT_MODEL_ID,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:3000",
      "X-Title": "Knowledge Base RAG",
    },
    isLocal: false,
  };
}

export async function chatCompletionStream(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const { temperature = 0.3, maxTokens = 2048, model } = options;
  const config = await getProviderConfig(model);

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: config.headers,
    body: JSON.stringify({
      model: config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const label = config.isLocal ? "Local AI" : "OpenRouter";
    throw new Error(`${label} API error: ${response.status} — ${errorText}`);
  }

  return response.body!;
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const { temperature = 0.3, maxTokens = 2048, model } = options;
  const config = await getProviderConfig(model);

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: config.headers,
    body: JSON.stringify({
      model: config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const label = config.isLocal ? "Local AI" : "OpenRouter";
    throw new Error(`${label} API error: ${response.status} — ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}
