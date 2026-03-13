"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FileText, Layers, MessageSquare, DollarSign } from "lucide-react";

interface UsageStatsSectionProps {
  stats: {
    documents: number;
    chunks: number;
    conversations: number;
    todaySpend: number;
    dailyBudget: number | null;
    dailyUsage: { day: string; total_tokens: number; total_cost: number }[];
  } | null;
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: typeof FileText }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-4">
      <Icon className="h-8 w-8 text-muted-foreground" />
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function UsageStatsSection({ stats }: UsageStatsSectionProps) {
  if (!stats) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage Statistics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Documents" value={String(stats.documents)} icon={FileText} />
          <StatCard label="Chunks" value={String(stats.chunks)} icon={Layers} />
          <StatCard label="Conversations" value={String(stats.conversations)} icon={MessageSquare} />
          <StatCard
            label="Today's Spend"
            value={`$${stats.todaySpend.toFixed(4)}`}
            icon={DollarSign}
          />
        </div>

        {stats.dailyUsage.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium">Daily Usage (Last 30 Days)</h4>
            <div className="max-h-60 overflow-y-auto rounded border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2 text-right">Tokens</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.dailyUsage.map((day) => (
                    <tr key={day.day} className="border-b last:border-0">
                      <td className="px-3 py-2">{day.day}</td>
                      <td className="px-3 py-2 text-right">{Number(day.total_tokens).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right">${Number(day.total_cost).toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
