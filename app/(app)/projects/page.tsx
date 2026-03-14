"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Project } from "@/lib/types";
import { PROJECT_TEMPLATES } from "@/lib/templates";
import { getTemplate } from "@/lib/templates";
import { formatDate } from "@/lib/utils";
import { Plus, FolderOpen, FileText, Trash2, Scale, Award, ArrowLeft } from "lucide-react";

const templateIcons: Record<string, typeof FolderOpen> = {
  FolderOpen,
  Scale,
  Award,
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProjects(data);
      })
      .finally(() => setLoading(false));
  }, []);

  async function createProject() {
    if (!newTitle.trim() || !selectedTemplate) return;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), template: selectedTemplate }),
    });
    const project = await res.json();
    setNewTitle("");
    setCreating(false);
    setSelectedTemplate(null);
    router.push(`/projects/${project.id}`);
  }

  async function deleteProject(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this project and all its sources and conversations?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => { setCreating(true); setSelectedTemplate(null); }}>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {creating && (
        <Card className="p-5">
          {!selectedTemplate ? (
            /* Step 1: Pick a template */
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold">Choose a project type</h3>
                <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {PROJECT_TEMPLATES.map((tmpl) => {
                  const Icon = templateIcons[tmpl.icon] || FolderOpen;
                  return (
                    <button
                      key={tmpl.id}
                      className="flex flex-col items-start gap-2 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
                      onClick={() => setSelectedTemplate(tmpl.id)}
                    >
                      <Icon className="h-6 w-6 text-primary" />
                      <div>
                        <p className="text-sm font-semibold">{tmpl.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {tmpl.description}
                        </p>
                      </div>
                      {tmpl.autoScrape.length > 0 && (
                        <span className="text-[10px] text-primary/70 font-medium">
                          Auto-loads reference documents
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Step 2: Enter project title */
            <div>
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span className="text-xs text-muted-foreground">
                  {getTemplate(selectedTemplate).name} project
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  autoFocus
                  type="text"
                  placeholder="Project name..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createProject()}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button size="sm" onClick={createProject} disabled={!newTitle.trim()}>
                  Create
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setCreating(false); setSelectedTemplate(null); setNewTitle(""); }}>
                  Cancel
                </Button>
              </div>
              {getTemplate(selectedTemplate).autoScrape.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Reference documents will be automatically scraped and loaded when the project is created.
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : projects.length === 0 && !creating ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No projects yet</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Create a project to organize your documents and chat with them.
          </p>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Create Your First Project
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const tmpl = getTemplate(project.template);
            const Icon = templateIcons[tmpl.icon] || FolderOpen;
            return (
              <Card
                key={project.id}
                className="group cursor-pointer p-5 transition-colors hover:bg-accent/50"
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className="h-8 w-8 text-primary" />
                    <div>
                      <h3 className="font-semibold">{project.title}</h3>
                      {project.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {project.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    className="hidden shrink-0 group-hover:block text-muted-foreground hover:text-destructive"
                    onClick={(e) => deleteProject(project.id, e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                  {tmpl.id !== "general" && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      {tmpl.name}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {project.document_count || 0} source{(project.document_count || 0) !== 1 ? "s" : ""}
                  </span>
                  <span>{formatDate(project.updated_at)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
