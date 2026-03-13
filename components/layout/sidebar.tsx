"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { FolderOpen, Settings, Database, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Project } from "@/lib/types";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProjects(data);
      });
  }, [pathname]);

  async function createProject() {
    if (!newTitle.trim()) return;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim() }),
    });
    const project = await res.json();
    setNewTitle("");
    setCreating(false);
    router.push(`/projects/${project.id}`);
  }

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-4">
        <Database className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">Knowledge Base</span>
      </div>

      <nav className="flex-1 flex flex-col overflow-hidden p-3">
        {/* Projects header */}
        <div className="flex items-center justify-between mb-1">
          <Link
            href="/projects"
            className={cn(
              "flex items-center gap-2 text-xs font-semibold uppercase tracking-wider",
              pathname === "/projects" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Projects
          </Link>
          <button
            onClick={() => setCreating(!creating)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {creating && (
          <div className="mb-2">
            <input
              autoFocus
              type="text"
              placeholder="Project name..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createProject();
                if (e.key === "Escape") { setCreating(false); setNewTitle(""); }
              }}
              onBlur={() => { if (!newTitle.trim()) { setCreating(false); setNewTitle(""); } }}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        )}

        {/* Project list */}
        <div className="flex-1 space-y-0.5 overflow-auto">
          {projects.map((project) => {
            const isActive = pathname === `/projects/${project.id}`;
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <FolderOpen className="h-4 w-4 shrink-0" />
                <span className="truncate">{project.title}</span>
              </Link>
            );
          })}
        </div>

        {/* Settings at bottom */}
        <div className="mt-auto pt-2 border-t border-border">
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              pathname.startsWith("/settings")
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </nav>
    </aside>
  );
}
