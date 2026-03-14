"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Loader2, Eye, EyeOff, Key, Monitor, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiProviderSectionProps {
  currentKey: string;
  settings: Record<string, string>;
  onSaved: () => void;
}

export function AiProviderSection({ currentKey, settings, onSaved }: AiProviderSectionProps) {
  const [mode, setMode] = useState<"cloud" | "local">(
    (settings.ai_mode as "cloud" | "local") || "cloud"
  );
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [localUrl, setLocalUrl] = useState(settings.local_ai_url || "");
  const [localModel, setLocalModel] = useState(settings.local_ai_model || "");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<"valid" | "invalid" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setMode((settings.ai_mode as "cloud" | "local") || "cloud");
    setLocalUrl(settings.local_ai_url || "");
    setLocalModel(settings.local_ai_model || "");
  }, [settings]);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setError("");

    try {
      const body =
        mode === "local"
          ? { mode: "local", localUrl, localModel }
          : { mode: "cloud", apiKey: key || currentKey };

      const res = await fetch("/api/settings/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setTestResult(data.valid ? "valid" : "invalid");
      if (!data.valid) setError(data.error || "Connection failed");
    } catch {
      setTestResult("invalid");
      setError("Failed to test connection");
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");

    try {
      // Save mode
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "ai_mode", value: mode }),
      });

      if (mode === "cloud" && key) {
        await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "openrouter_api_key", value: key }),
        });
      }

      if (mode === "local") {
        await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "local_ai_url", value: localUrl }),
        });
        await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "local_ai_model", value: localModel }),
        });
      }

      setKey("");
      setTestResult(null);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const canTest =
    mode === "cloud"
      ? !!(key || (currentKey && !currentKey.includes("...")))
      : !!(localUrl && localModel);

  const canSave =
    mode === "cloud"
      ? true // can save mode switch even without new key
      : !!(localUrl && localModel);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          AI Provider
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode toggle */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          <button
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              mode === "cloud" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => { setMode("cloud"); setTestResult(null); }}
          >
            <Cloud className="h-4 w-4" />
            Cloud AI
          </button>
          <button
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              mode === "local" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => { setMode("local"); setTestResult(null); }}
          >
            <Monitor className="h-4 w-4" />
            Local AI
          </button>
        </div>

        {mode === "cloud" ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Uses OpenRouter to access DeepSeek, GPT-4o, Claude, Gemini, and more.
            </p>
            {currentKey && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Current key:</span>
                <code className="rounded bg-muted px-2 py-0.5">{currentKey}</code>
              </div>
            )}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? "text" : "password"}
                  placeholder="sk-or-v1-..."
                  value={key}
                  onChange={(e) => { setKey(e.target.value); setTestResult(null); }}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Connect to Ollama, LM Studio, vLLM, or any OpenAI-compatible server on your network.
            </p>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Endpoint URL</label>
              <Input
                placeholder="http://192.168.1.100:11434/v1"
                value={localUrl}
                onChange={(e) => { setLocalUrl(e.target.value); setTestResult(null); }}
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Ollama: http://host:11434/v1 &middot; LM Studio: http://host:1234/v1
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Model Name</label>
              <Input
                placeholder="qwen2.5:72b"
                value={localModel}
                onChange={(e) => { setLocalModel(e.target.value); setTestResult(null); }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTest} disabled={testing || !canTest}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
          </Button>
          <Button onClick={handleSave} disabled={saving || !canSave}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>

        {testResult && (
          <div className={`flex items-center gap-2 text-sm ${testResult === "valid" ? "text-status-completed" : "text-status-failed"}`}>
            {testResult === "valid" ? (
              <><CheckCircle className="h-4 w-4" /> {mode === "local" ? "Connected to local model" : "API key is valid"}</>
            ) : (
              <><XCircle className="h-4 w-4" /> {error || "Connection failed"}</>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
