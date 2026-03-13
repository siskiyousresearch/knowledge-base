"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate } from "@/lib/utils";
import { Artifact } from "@/lib/types";
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  FileText,
  HelpCircle,
  BookOpen,
  Briefcase,
  Package,
} from "lucide-react";

interface ArtifactsPanelProps {
  projectId: string;
}

const typeLabels: Record<string, string> = {
  summary: "Summary",
  faq: "FAQ",
  study_guide: "Study Guide",
  briefing: "Briefing",
};

const typeIcons: Record<string, typeof FileText> = {
  summary: FileText,
  faq: HelpCircle,
  study_guide: BookOpen,
  briefing: Briefcase,
};

export function ArtifactsPanel({ projectId }: ArtifactsPanelProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchArtifacts = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/artifacts`);
      const data = await res.json();
      if (Array.isArray(data)) setArtifacts(data);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this artifact?")) return;

    await fetch(`/api/projects/${projectId}/artifacts/${id}`, {
      method: "DELETE",
    });
    setArtifacts((prev) => prev.filter((a) => a.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        <h3 className="text-sm font-semibold">Generated Artifacts</h3>
        <p className="text-xs text-muted-foreground">
          {artifacts.length} artifact{artifacts.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : artifacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Package className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="mb-1 text-sm font-medium">No artifacts yet</p>
            <p className="text-xs text-muted-foreground">
              Generate summaries, FAQs, study guides, and more.
            </p>
          </div>
        ) : (
          artifacts.map((artifact) => {
            const Icon = typeIcons[artifact.type] || FileText;
            const isExpanded = expandedId === artifact.id;

            return (
              <Card key={artifact.id} className="overflow-hidden">
                <div
                  className="flex cursor-pointer items-center gap-2 p-3"
                  onClick={() => toggleExpand(artifact.id)}
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {artifact.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDate(artifact.created_at)}
                    </p>
                  </div>
                  <Badge className="text-[10px]">
                    {typeLabels[artifact.type] || artifact.type}
                  </Badge>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t border-border">
                    <div className="max-h-64 overflow-auto p-3">
                      <div className="whitespace-pre-wrap text-sm">
                        {artifact.content}
                      </div>
                    </div>
                    <div className="flex justify-end border-t border-border p-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(artifact.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
