"use client";

import { Button } from "@/components/ui/button";
import { ChatMessage } from "@/lib/types";
import { Download } from "lucide-react";

interface ExportButtonProps {
  messages: ChatMessage[];
  title: string;
  projectTitle?: string;
}

export function ExportButton({ messages, title, projectTitle }: ExportButtonProps) {
  function handleExport() {
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const lines: string[] = [];

    lines.push(`# ${title}`);
    if (projectTitle) {
      lines.push(`*Project: ${projectTitle}*`);
    }
    lines.push(`*Exported on ${date}*`);
    lines.push("");
    lines.push("---");
    lines.push("");

    for (const msg of messages) {
      if (msg.role === "user") {
        lines.push(`**You:** ${msg.content}`);
      } else if (msg.role === "assistant") {
        lines.push(`**Assistant:** ${msg.content}`);

        if (msg.sources && msg.sources.length > 0) {
          const sourceTitles = msg.sources
            .map((s) => s.document_title || "Unknown")
            .filter((t, i, arr) => arr.indexOf(t) === i);
          lines.push("");
          lines.push(`> Sources: ${sourceTitles.join(", ")}`);
        }
      }

      lines.push("");
      lines.push("---");
      lines.push("");
    }

    const markdown = lines.join("\n");
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-").toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (messages.length === 0) return null;

  return (
    <Button size="sm" variant="ghost" onClick={handleExport}>
      <Download className="h-4 w-4" />
      Export
    </Button>
  );
}
