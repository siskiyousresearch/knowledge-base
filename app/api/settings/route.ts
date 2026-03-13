import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { setSetting, clearSettingsCache } from "@/lib/settings";

const SENSITIVE_KEYS = ["openrouter_api_key"];

function redactValue(key: string, value: string): string {
  if (SENSITIVE_KEYS.includes(key) && value.length > 8) {
    return value.slice(0, 4) + "..." + value.slice(-4);
  }
  return value;
}

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("knowledge_settings")
      .select("key, value, updated_at")
      .order("key");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const redacted = (data || []).map((s) => ({
      ...s,
      value: redactValue(s.key, s.value),
    }));

    return NextResponse.json(redacted);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { key, value } = await request.json();

    if (!key || value === undefined) {
      return NextResponse.json({ error: "key and value required" }, { status: 400 });
    }

    await setSetting(key, value);
    clearSettingsCache();

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
