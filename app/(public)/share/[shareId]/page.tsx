"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Project, Document, Artifact } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatFileSize } from "@/lib/utils";
import { FolderOpen, FileText, Globe, FileSpreadsheet, FileType, Presentation, Image } from "lucide-react";
import ReactMarkdown from "react-markdown";

const fileTypeIcons: Record<string, typeof FileText> = {
  ".pdf": FileText, ".docx": FileType, ".txt": FileText, ".md": FileText,
  ".csv": FileSpreadsheet, ".xlsx": FileSpreadsheet, ".pptx": Presentation,
  ".png": Image, ".jpg": Image, ".jpeg": Image, ".gif": Image, ".webp": Image,
  url: Globe,
};

export default function SharedProjectPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewingArtifact, setViewingArtifact] = useState<Artifact | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/share/${shareId}`);
        if (!res.ok) {
          setError("This project is not shared or does not exist.");
          return;
        }
        const data = await res.json();
        setProject(data.project);
        setDocuments(data.documents || []);
        setArtifacts(data.artifacts || []);
      } catch {
        setError("Failed to load shared project.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [shareId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl p-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">{error || "Project not found"}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-8 space-y-6">
      <div className="flex items-center gap-3">
        <FolderOpen className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{project.title}</h1>
          {project.description && (
            <p className="text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        <Badge variant="completed" className="ml-auto">Shared</Badge>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Sources ({documents.length})</h2>
        <div className="space-y-2">
          {documents.map((doc) => {
            const Icon = fileTypeIcons[doc.file_type || ""] || FileText;
            return (
              <Card key={doc.id} className="flex items-center gap-3 p-3">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {doc.file_size && <span>{formatFileSize(doc.file_size)}</span>}
                    {doc.chunk_count > 0 && <span>{doc.chunk_count} chunks</span>}
                    <span>{formatDate(doc.created_at)}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {artifacts.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Generated Content</h2>
          <div className="space-y-2">
            {artifacts.map((artifact) => (
              <Card
                key={artifact.id}
                className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setViewingArtifact(viewingArtifact?.id === artifact.id ? null : artifact)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="processing">{artifact.type.replace("_", " ")}</Badge>
                  <span className="text-sm font-medium">{artifact.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{formatDate(artifact.created_at)}</span>
                </div>
                {viewingArtifact?.id === artifact.id && (
                  <div className="mt-3 prose prose-sm max-w-none dark:prose-invert border-t pt-3">
                    <ReactMarkdown>{artifact.content}</ReactMarkdown>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground pt-8">
        Shared from Knowledge Base
      </p>
    </div>
  );
}
