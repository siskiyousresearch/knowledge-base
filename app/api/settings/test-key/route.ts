import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, apiKey, localUrl, localModel } = body;

    if (mode === "local") {
      if (!localUrl) {
        return NextResponse.json({ error: "localUrl required" }, { status: 400 });
      }
      if (!localModel) {
        return NextResponse.json({ error: "localModel required" }, { status: 400 });
      }

      // Test the local AI endpoint with a minimal chat completion
      const res = await fetch(`${localUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: localModel,
          messages: [{ role: "user", content: "Say hello" }],
          max_tokens: 10,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json({
          valid: false,
          error: `Local AI returned ${res.status}: ${text.slice(0, 200)}`,
        });
      }

      return NextResponse.json({ valid: true });
    }

    // Cloud mode (default) — test OpenRouter key
    if (!apiKey) {
      return NextResponse.json({ error: "apiKey required" }, { status: 400 });
    }

    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({
        valid: false,
        error: `API returned ${res.status}: ${text.slice(0, 200)}`,
      });
    }

    return NextResponse.json({ valid: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ valid: false, error: msg });
  }
}
