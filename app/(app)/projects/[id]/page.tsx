"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Project } from "@/lib/types";
import { SourcesPanel } from "@/components/projects/sources-panel";
import { ChatPanel } from "@/components/chat/chat-panel";
import { NotesPanel } from "@/components/projects/notes-panel";
import { ArtifactsPanel } from "@/components/projects/artifacts-panel";
import { GenerateDialog } from "@/components/projects/generate-dialog";
import { ShareDialog } from "@/components/projects/share-dialog";
import { SourceViewer } from "@/components/projects/source-viewer";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AVAILABLE_MODELS } from "@/lib/ai/models";
import { getTemplate, PROJECT_TEMPLATES } from "@/lib/templates";
import {
  ArrowLeft,
  Pencil,
  Check,
  X,
  Share2,
  Sparkles,
  StickyNote,
  MessageSquare,
  FileText,
  BookOpen,
  Monitor,
  FolderOpen,
  Scale,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";

const templateIcons: Record<string, typeof FolderOpen> = {
  FolderOpen,
  Scale,
  Award,
};

type Tab = "chat" | "notes" | "artifacts";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<string>("cloud");
  const [localModelName, setLocalModelName] = useState<string>("");
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = Math.min(Math.max(200, e.clientX - rect.left), rect.width - 300);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

  useEffect(() => {
    fetch(`/api/projects/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setProject(data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const map = Object.fromEntries(data.map((s: { key: string; value: string }) => [s.key, s.value]));
          setAiMode(map.ai_mode || "cloud");
          setLocalModelName(map.local_ai_model || "");
        }
      });
  }, []);

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

  async function changeModel(modelId: string) {
    if (!project) return;
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model_id: modelId || null }),
    });
    const updated = await res.json();
    setProject(updated);
  }

  async function changeTemplate(templateId: string) {
    if (!project) return;
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: templateId }),
    });
    const updated = await res.json();
    setProject(updated);
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

  const tabs: { id: Tab; label: string; icon: typeof MessageSquare }[] = [
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "notes", label: "Notes", icon: StickyNote },
    { id: "artifacts", label: "Guides", icon: BookOpen },
  ];

  return (
    <div className="flex h-full flex-col -m-6">
      {/* Project header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
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

        <div className="ml-auto flex items-center gap-2">
          {/* Template selector */}
          <select
            className="rounded-md border border-border bg-background px-2 py-1 text-xs"
            value={project.template || "general"}
            onChange={(e) => changeTemplate(e.target.value)}
          >
            {PROJECT_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {/* Model selector */}
          {aiMode === "local" ? (
            <span className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
              <Monitor className="h-3 w-3" />
              {localModelName || "Local AI"}
            </span>
          ) : (
            <select
              className="rounded-md border border-border bg-background px-2 py-1 text-xs"
              value={project.model_id || ""}
              onChange={(e) => changeModel(e.target.value)}
            >
              <option value="">Default (DeepSeek V3)</option>
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}

          <Button size="sm" variant="outline" onClick={() => setGenerateOpen(true)}>
            <Sparkles className="h-3.5 w-3.5" />
            Generate
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShareOpen(true)}>
            <Share2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Split view: Sources | Content */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* Left: Sources */}
        <div style={{ width: sidebarWidth, minWidth: 200 }} className="border-r border-border overflow-hidden shrink-0">
          <SourcesPanel projectId={id} onViewDocument={setViewingDocId} documentCategories={getTemplate(project.template).documentCategories} />
        </div>

        {/* Drag handle */}
        <div
          className="w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors shrink-0"
          onMouseDown={handleMouseDown}
        />

        {/* Right: Tabs */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-border bg-card/50">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "chat" && <ChatPanel projectId={id} />}
            {activeTab === "notes" && <NotesPanel projectId={id} />}
            {activeTab === "artifacts" && <ArtifactsPanel projectId={id} />}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <GenerateDialog
        projectId={id}
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onGenerated={() => { setGenerateOpen(false); setActiveTab("artifacts"); }}
      />
      <ShareDialog
        project={project}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onUpdate={setProject}
      />
      <SourceViewer
        documentId={viewingDocId}
        onClose={() => setViewingDocId(null)}
      />
    </div>
  );
}
