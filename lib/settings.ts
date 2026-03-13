import { createAdminClient } from "@/lib/supabase/admin";

const cache = new Map<string, { value: string; expiry: number }>();
const CACHE_TTL = 60_000; // 60 seconds

const ENV_FALLBACKS: Record<string, string | undefined> = {
  openrouter_api_key: process.env.OPENROUTER_API_KEY,
};

export async function getSetting(key: string): Promise<string | null> {
  // Check cache first
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiry) {
    return cached.value;
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("knowledge_settings")
      .select("value")
      .eq("key", key)
      .single();

    if (!error && data?.value) {
      cache.set(key, { value: data.value, expiry: Date.now() + CACHE_TTL });
      return data.value;
    }
  } catch {
    // DB not available, fall through to env var
  }

  // Fallback to env var
  return ENV_FALLBACKS[key] || null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("knowledge_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) {
    throw new Error(`Failed to save setting: ${error.message}`);
  }

  // Update cache
  cache.set(key, { value, expiry: Date.now() + CACHE_TTL });
}

export function clearSettingsCache() {
  cache.clear();
}
