"use client";

import { useState } from "react";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  FileText,
  HelpCircle,
  BookOpen,
  Briefcase,
  Loader2,
  CheckCircle,
  ArrowLeft,
} from "lucide-react";

interface GenerateDialogProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onGenerated: () => void;
}

const artifactTypes = [
  {
    type: "summary",
    title: "Summary",
    description: "A concise overview of your project's key points and themes.",
    icon: FileText,
  },
  {
    type: "faq",
    title: "FAQ",
    description: "Frequently asked questions and answers based on your sources.",
    icon: HelpCircle,
  },
  {
    type: "study_guide",
    title: "Study Guide",
    description: "Structured study material with key concepts and review questions.",
    icon: BookOpen,
  },
  {
    type: "briefing",
    title: "Briefing",
    description: "An executive briefing document highlighting critical information.",
    icon: Briefcase,
  },
];

export function GenerateDialog({
  projectId,
  open,
  onClose,
  onGenerated,
}: GenerateDialogProps) {
  const [generating, setGenerating] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [streamedContent, setStreamedContent] = useState("");
  const [done, setDone] = useState(false);

  function reset() {
    setGenerating(false);
    setSelectedType(null);
    setStreamedContent("");
    setDone(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleGenerate(type: string) {
    setSelectedType(type);
    setGenerating(true);
    setStreamedContent("");
    setDone(false);

    try {
      const res = await fetch(`/api/projects/${projectId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });

      if (!res.ok) throw new Error("Generation failed");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let content = "";

      while (true) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              content += parsed.content;
              setStreamedContent(content);
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }

      setDone(true);
      onGenerated();
    } catch {
      setStreamedContent("Failed to generate. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  const selectedInfo = artifactTypes.find((a) => a.type === selectedType);

  return (
    <Dialog open={open} onClose={handleClose} className="max-w-xl">
      <DialogTitle>
        {selectedType ? (
          <div className="flex items-center gap-2">
            {!done && !generating && (
              <button
                onClick={reset}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            {selectedInfo?.title || "Generate"}
          </div>
        ) : (
          "Generate Artifact"
        )}
      </DialogTitle>

      <div className="mt-4">
        {!selectedType ? (
          <div className="grid grid-cols-2 gap-3">
            {artifactTypes.map(({ type, title, description, icon: Icon }) => (
              <Card
                key={type}
                className="cursor-pointer p-4 transition-colors hover:bg-accent"
                onClick={() => handleGenerate(type)}
              >
                <Icon className="mb-2 h-6 w-6 text-primary" />
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {description}
                </p>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {done && (
              <div className="flex items-center gap-2 rounded-lg bg-status-completed/10 px-3 py-2 text-sm text-status-completed">
                <CheckCircle className="h-4 w-4" />
                Generated successfully
              </div>
            )}

            <div
              className={cn(
                "max-h-[50vh] overflow-auto rounded-lg border border-border bg-muted/30 p-4",
                generating && !streamedContent && "flex items-center justify-center py-12"
              )}
            >
              {generating && !streamedContent ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <div className="whitespace-pre-wrap text-sm">
                  {streamedContent}
                  {generating && (
                    <span className="inline-block ml-1 h-4 w-1 animate-pulse bg-foreground" />
                  )}
                </div>
              )}
            </div>

            {done && (
              <div className="flex justify-end">
                <Button size="sm" onClick={handleClose}>
                  Done
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
