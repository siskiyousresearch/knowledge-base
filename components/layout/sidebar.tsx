"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { FolderOpen, Settings, Database, Plus, LogOut, Scale, Award } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Project } from "@/lib/types";
import { getTemplate } from "@/lib/templates";

const templateIcons: Record<string, typeof FolderOpen> = {
  FolderOpen,
  Scale,
  Award,
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setProjects(data);
      });
  }, [pathname]);

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
            onClick={() => router.push("/projects?create=true")}
            className="text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Project list */}
        <div className="flex-1 space-y-0.5 overflow-auto">
          {projects.map((project) => {
            const isActive = pathname === `/projects/${project.id}`;
            const tmpl = getTemplate(project.template);
            const Icon = templateIcons[tmpl.icon] || FolderOpen;
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
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{project.title}</span>
              </Link>
            );
          })}
        </div>

        {/* Settings and logout at bottom */}
        <div className="mt-auto pt-2 border-t border-border space-y-0.5">
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
          <button
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signOut();
              router.push("/login");
              router.refresh();
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </nav>
    </aside>
  );
}
