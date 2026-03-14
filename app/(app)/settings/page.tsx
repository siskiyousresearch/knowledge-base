"use client";

import { useEffect, useState, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AiProviderSection } from "@/components/settings/ai-provider-section";
import { UsageStatsSection } from "@/components/settings/usage-stats-section";
import { BudgetSection } from "@/components/settings/budget-section";

interface Settings {
  key: string;
  value: string;
}

interface Stats {
  documents: number;
  chunks: number;
  conversations: number;
  todaySpend: number;
  dailyBudget: number | null;
  dailyUsage: { day: string; total_tokens: number; total_cost: number }[];
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [settingsRes, statsRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/stats"),
      ]);

      const settingsData = await settingsRes.json();
      const statsData = await statsRes.json();

      if (Array.isArray(settingsData)) setSettings(settingsData);
      if (statsData && !statsData.error) setStats(statsData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentApiKey = settings.find((s) => s.key === "openrouter_api_key")?.value || "";
  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AiProviderSection currentKey={currentApiKey} settings={settingsMap} onSaved={fetchData} />
      <BudgetSection
        currentBudget={stats?.dailyBudget || null}
        todaySpend={stats?.todaySpend || 0}
        onSaved={fetchData}
      />
      <UsageStatsSection stats={stats} />
    </div>
  );
}
