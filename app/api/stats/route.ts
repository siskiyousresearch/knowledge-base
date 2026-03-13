import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTodaySpend } from "@/lib/ai/usage";
import { getSetting } from "@/lib/settings";

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Run queries in parallel
    const [docsRes, chunksRes, convsRes, usageRes, todaySpend, dailyBudget] = await Promise.all([
      supabase.from("knowledge_documents").select("id", { count: "exact", head: true }),
      supabase.from("knowledge_document_chunks").select("id", { count: "exact", head: true }),
      supabase.from("knowledge_conversations").select("id", { count: "exact", head: true }),
      supabase.rpc("knowledge_daily_usage", { days: 30 }),
      getTodaySpend(),
      getSetting("daily_budget_usd"),
    ]);

    return NextResponse.json({
      documents: docsRes.count || 0,
      chunks: chunksRes.count || 0,
      conversations: convsRes.count || 0,
      todaySpend,
      dailyBudget: dailyBudget ? parseFloat(dailyBudget) : null,
      dailyUsage: usageRes.data || [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
