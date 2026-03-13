"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DollarSign, Loader2 } from "lucide-react";

interface BudgetSectionProps {
  currentBudget: number | null;
  todaySpend: number;
  onSaved: () => void;
}

export function BudgetSection({ currentBudget, todaySpend, onSaved }: BudgetSectionProps) {
  const [budget, setBudget] = useState(currentBudget?.toString() || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");

    try {
      const value = budget.trim() === "" ? "0" : budget;
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) {
        throw new Error("Enter a valid dollar amount");
      }

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "daily_budget_usd", value: String(num) }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "daily_budget_usd", value: "0" }),
      });
      setBudget("");
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  const pct = currentBudget && currentBudget > 0
    ? Math.min((todaySpend / currentBudget) * 100, 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Daily Token Budget
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentBudget && currentBudget > 0 ? (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Today: ${todaySpend.toFixed(4)}</span>
              <span>Limit: ${currentBudget.toFixed(2)}</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-status-failed" : pct >= 70 ? "bg-yellow-500" : "bg-status-completed"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No daily budget set. Chat usage is unlimited.</p>
        )}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <DollarSign className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 5.00"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              className="pl-7"
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set Budget"}
          </Button>
          {currentBudget && currentBudget > 0 && (
            <Button variant="outline" onClick={handleRemove} disabled={saving}>
              Remove
            </Button>
          )}
        </div>

        {error && <p className="text-sm text-status-failed">{error}</p>}
      </CardContent>
    </Card>
  );
}
