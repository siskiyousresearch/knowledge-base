"use client";

import { useState } from "react";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Project } from "@/lib/types";
import { Link, Copy, Check, Loader2 } from "lucide-react";

interface ShareDialogProps {
  project: Project;
  onUpdate: (project: Project) => void;
  open: boolean;
  onClose: () => void;
}

export function ShareDialog({
  project,
  onUpdate,
  open,
  onClose,
}: ShareDialogProps) {
  const [toggling, setToggling] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = project.share_id
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${project.share_id}`
    : "";

  async function toggleSharing() {
    setToggling(true);

    try {
      if (project.is_shared) {
        const res = await fetch(`/api/projects/${project.id}/share`, {
          method: "DELETE",
        });
        if (res.ok) {
          onUpdate({ ...project, is_shared: false, share_id: null });
        }
      } else {
        const res = await fetch(`/api/projects/${project.id}/share`, {
          method: "POST",
        });
        if (res.ok) {
          const data = await res.json();
          onUpdate({
            ...project,
            is_shared: true,
            share_id: data.share_id || data.shareId,
          });
        }
      }
    } finally {
      setToggling(false);
    }
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Share Project</DialogTitle>

      <div className="mt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Public sharing</p>
            <p className="text-xs text-muted-foreground">
              Anyone with the link can view this project
            </p>
          </div>
          <button
            onClick={toggleSharing}
            disabled={toggling}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
              project.is_shared ? "bg-primary" : "bg-muted"
            )}
          >
            {toggling ? (
              <Loader2 className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 animate-spin" />
            ) : (
              <span
                className={cn(
                  "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                  project.is_shared ? "translate-x-[22px]" : "translate-x-0.5"
                )}
              />
            )}
          </button>
        </div>

        {project.is_shared && shareUrl && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Share link
            </p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Link className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  readOnly
                  value={shareUrl}
                  className="pl-9 text-xs"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
              </div>
              <Button size="sm" variant="outline" onClick={copyToClipboard}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-status-completed" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
