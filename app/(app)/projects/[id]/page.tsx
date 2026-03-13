"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Project } from "@/lib/types";
import { SourcesPanel } from "@/components/projects/sources-panel";
import { ChatPanel } from "@/components/chat/chat-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pencil, Check, X } from "lucide-react";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setProject(data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function saveTitle() {
    if (!editTitle.trim() || !project) return;
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle.trim() }),
    });
    const updated = await res.json();
    setProject(updated);
    setEditing(false);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[calc(100vh-12rem)] w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-muted-foreground mb-4">Project not found</p>
        <Button variant="outline" onClick={() => router.push("/projects")}>
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col -m-6">
      {/* Project header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.push("/projects")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveTitle()}
              className="rounded-md border border-input bg-background px-2 py-1 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button onClick={saveTitle}><Check className="h-4 w-4 text-primary" /></button>
            <button onClick={() => setEditing(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{project.title}</h2>
            <button
              onClick={() => { setEditTitle(project.title); setEditing(true); }}
              className="text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Split view: Sources | Chat */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 border-r border-border overflow-hidden">
          <SourcesPanel projectId={id} />
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatPanel projectId={id} />
        </div>
      </div>
    </div>
  );
}
