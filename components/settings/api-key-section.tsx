"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Loader2, Eye, EyeOff, Key } from "lucide-react";

interface ApiKeySectionProps {
  currentKey: string;
  onSaved: () => void;
}

export function ApiKeySection({ currentKey, onSaved }: ApiKeySectionProps) {
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<"valid" | "invalid" | null>(null);
  const [error, setError] = useState("");

  async function handleTest() {
    const testKey = key || currentKey;
    if (!testKey || testKey.includes("...")) return;

    setTesting(true);
    setTestResult(null);
    setError("");

    try {
      const res = await fetch("/api/settings/test-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: testKey }),
      });
      const data = await res.json();
      setTestResult(data.valid ? "valid" : "invalid");
      if (!data.valid) setError(data.error || "Invalid key");
    } catch {
      setTestResult("invalid");
      setError("Failed to test key");
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!key) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "openrouter_api_key", value: key }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          OpenRouter API Key
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <Button variant="outline" onClick={handleTest} disabled={testing || (!key && !currentKey)}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
          </Button>
          <Button onClick={handleSave} disabled={saving || !key}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>

        {testResult && (
          <div className={`flex items-center gap-2 text-sm ${testResult === "valid" ? "text-status-completed" : "text-status-failed"}`}>
            {testResult === "valid" ? (
              <><CheckCircle className="h-4 w-4" /> API key is valid</>
            ) : (
              <><XCircle className="h-4 w-4" /> {error || "Invalid API key"}</>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
