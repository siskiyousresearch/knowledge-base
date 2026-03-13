"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Tag } from "@/lib/types";
import { Plus, X, Tag as TagIcon, Loader2 } from "lucide-react";

interface TagManagerProps {
  projectId: string;
  documentId: string;
  currentTags: Tag[];
  onUpdate: () => void;
}

const PRESET_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
];

export function TagManager({
  projectId,
  documentId,
  currentTags,
  onUpdate,
}: TagManagerProps) {
  const [open, setOpen] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[4]);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const fetchAllTags = useCallback(async () => {
    try {
      const res = await fetch(`/api/tags?projectId=${projectId}`);
      const data = await res.json();
      if (Array.isArray(data)) setAllTags(data);
    } catch {
      // Ignore
    }
  }, [projectId]);

  useEffect(() => {
    if (open) fetchAllTags();
  }, [open, fetchAllTags]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  async function assignTag(tagId: string) {
    setLoading(true);
    try {
      await fetch(`/api/documents/${documentId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId }),
      });
      onUpdate();
    } finally {
      setLoading(false);
    }
  }

  async function removeTag(tagId: string) {
    setLoading(true);
    try {
      await fetch(`/api/documents/${documentId}/tags`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId }),
      });
      onUpdate();
    } finally {
      setLoading(false);
    }
  }

  async function createTag() {
    if (!newTagName.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          name: newTagName.trim(),
          color: newTagColor,
        }),
      });

      if (res.ok) {
        const tag = await res.json();
        setNewTagName("");
        await fetchAllTags();
        await assignTag(tag.id);
      }
    } finally {
      setLoading(false);
    }
  }

  const currentTagIds = new Set(currentTags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !currentTagIds.has(t.id));

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1">
        {currentTags.map((tag) => (
          <Badge
            key={tag.id}
            className="gap-1 text-[10px] text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              className="ml-0.5 rounded-full hover:bg-white/20"
              onClick={() => removeTag(tag.id)}
              disabled={loading}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
        <button
          className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary hover:text-primary"
          onClick={() => setOpen(!open)}
        >
          <Plus className="h-2.5 w-2.5" />
          Tag
        </button>
      </div>

      {open && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-card p-2 shadow-lg"
        >
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-card/80">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}

          {availableTags.length > 0 && (
            <div className="mb-2 space-y-0.5">
              <p className="px-1 text-[10px] font-medium text-muted-foreground uppercase">
                Available tags
              </p>
              {availableTags.map((tag) => (
                <button
                  key={tag.id}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-accent"
                  onClick={() => assignTag(tag.id)}
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-border pt-2">
            <p className="mb-1 px-1 text-[10px] font-medium text-muted-foreground uppercase">
              Create new tag
            </p>
            <div className="flex items-center gap-1.5">
              <Input
                placeholder="Tag name"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="h-7 text-xs"
                onKeyDown={(e) => e.key === "Enter" && createTag()}
              />
              <Button
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={createTag}
                disabled={!newTagName.trim()}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="mt-1.5 flex gap-1">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  className={cn(
                    "h-5 w-5 rounded-full transition-transform",
                    newTagColor === color && "ring-2 ring-ring ring-offset-1 ring-offset-card scale-110"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setNewTagColor(color)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
