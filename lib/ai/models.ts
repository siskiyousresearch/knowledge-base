import { ModelOption } from "@/lib/types";

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: "deepseek/deepseek-chat-v3-0324",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    pricing: { input: 0.14, output: 0.28 },
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    pricing: { input: 0.15, output: 0.60 },
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    pricing: { input: 2.50, output: 10.0 },
  },
  {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "Anthropic",
    pricing: { input: 3.0, output: 15.0 },
  },
  {
    id: "anthropic/claude-haiku-4",
    name: "Claude Haiku 4",
    provider: "Anthropic",
    pricing: { input: 0.80, output: 4.0 },
  },
  {
    id: "google/gemini-2.5-flash-preview",
    name: "Gemini 2.5 Flash",
    provider: "Google",
    pricing: { input: 0.15, output: 0.60 },
  },
  {
    id: "google/gemini-2.5-pro-preview",
    name: "Gemini 2.5 Pro",
    provider: "Google",
    pricing: { input: 1.25, output: 10.0 },
  },
];

export const DEFAULT_MODEL_ID = "deepseek/deepseek-chat-v3-0324";

export function getModelById(id: string): ModelOption | undefined {
  return AVAILABLE_MODELS.find((m) => m.id === id);
}
