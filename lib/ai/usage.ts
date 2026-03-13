import { createAdminClient } from "@/lib/supabase/admin";
import { getSetting } from "@/lib/settings";

// DeepSeek v3 pricing via OpenRouter (per million tokens)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "deepseek/deepseek-chat-v3-0324": { input: 0.14, output: 0.28 },
};

const DEFAULT_PRICING = { input: 0.50, output: 1.50 }; // conservative fallback

export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = MODEL_PRICING[model] || DEFAULT_PRICING;
  return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
}

export async function logUsage(params: {
  conversationId?: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}): Promise<void> {
  const totalTokens = params.promptTokens + params.completionTokens;
  const costUsd = calculateCost(params.model, params.promptTokens, params.completionTokens);

  const supabase = createAdminClient();
  await supabase.from("knowledge_usage_log").insert({
    conversation_id: params.conversationId || null,
    model: params.model,
    prompt_tokens: params.promptTokens,
    completion_tokens: params.completionTokens,
    total_tokens: totalTokens,
    cost_usd: costUsd,
  });
}

export async function getTodaySpend(): Promise<number> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("knowledge_usage_log")
    .select("cost_usd")
    .gte("created_at", today);

  if (!data?.length) return 0;
  return data.reduce((sum, row) => sum + Number(row.cost_usd), 0);
}

export async function checkBudget(): Promise<{ allowed: boolean; todaySpend: number; dailyBudget: number | null }> {
  const budgetStr = await getSetting("daily_budget_usd");
  if (!budgetStr) {
    return { allowed: true, todaySpend: 0, dailyBudget: null };
  }

  const dailyBudget = parseFloat(budgetStr);
  if (isNaN(dailyBudget) || dailyBudget <= 0) {
    return { allowed: true, todaySpend: 0, dailyBudget: null };
  }

  const todaySpend = await getTodaySpend();
  return {
    allowed: todaySpend < dailyBudget,
    todaySpend,
    dailyBudget,
  };
}
