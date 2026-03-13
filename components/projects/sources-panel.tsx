"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UploadDialog } from "@/components/documents/upload-dialog";
import { Document, DocumentStatus } from "@/lib/types";
import { formatDate, formatFileSize } from "@/lib/utils";
import {
  Plus,
  FileText,
  FileSpreadsheet,
  FileType,
  Globe,
  Presentation,
  Image,
  Trash2,
  Loader2,
} from "lucide-react";

const fileTypeIcons: Record<string, typeof FileText> = {
  ".pdf": FileText,
  ".docx": FileType,
  ".txt": FileText,
  ".md": FileText,
  ".csv": FileSpreadsheet,
  ".xlsx": FileSpreadsheet,
  ".xls": FileSpreadsheet,
  ".pptx": Presentation,
  ".png": Image,
  ".jpg": Image,
  ".jpeg": Image,
  ".gif": Image,
  ".webp": Image,
  ".bmp": Image,
  ".tiff": Image,
  ".tif": Image,
  ".svg": Image,
  url: Globe,
};

const statusVariants: Record<DocumentStatus, "pending" | "processing" | "completed" | "failed"> = {
  pending: "pending",
  processing: "processing",
  completed: "completed",
  failed: "failed",
};

interface SourcesPanelProps {
  projectId: string;
}

export function SourcesPanel({ projectId }: SourcesPanelProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const processingRef = useRef<Set<string>>(new Set());

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents?projectId=${projectId}`);
      const data = await res.json();
      if (Array.isArray(data)) setDocuments(data);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Background queue processor
  useEffect(() => {
    const pendingDocs = documents.filter(
      (d) => d.status === "pending" && d.file_name && !processingRef.current.has(d.id)
    );

    if (pendingDocs.length === 0) return;

    async function processNext() {
      const doc = pendingDocs[0];
      if (!doc || processingRef.current.has(doc.id)) return;

      processingRef.current.add(doc.id);

      try {
        if (doc.source === "url") {
          const url = (doc.metadata?.url as string) || doc.file_name;
          await fetch("/api/documents/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              documentId: doc.id,
              url,
              crawlJobId: doc.crawl_job_id,
              crawlDepth: doc.crawl_depth,
              projectId,
            }),
          });
        } else {
          const storagePath = (doc.metadata?.storagePath as string | undefined)
            || `uploads/${doc.id}/${doc.file_name}`;
          await fetch("/api/documents/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId: doc.id, storagePath }),
          });
        }
      } finally {
        processingRef.current.delete(doc.id);
        fetchDocuments();
      }
    }

    const timer = setTimeout(processNext, 2000);
    return () => clearTimeout(timer);
  }, [documents, fetchDocuments, projectId]);

  // Poll while active
  useEffect(() => {
    const hasActive = documents.some((d) => d.status === "processing" || d.status === "pending");
    if (!hasActive) return;
    const interval = setInterval(fetchDocuments, 3000);
    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this source and all its chunks?")) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  function handleUploadComplete() {
    setUploadOpen(false);
    fetchDocuments();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold">Sources</h3>
          <p className="text-xs text-muted-foreground">
            {documents.length} source{documents.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <FileText className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="mb-1 text-sm font-medium">No sources yet</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Upload files or add URLs to build your knowledge base.
            </p>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add Sources
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {documents.map((doc) => {
              const Icon = fileTypeIcons[doc.file_type || ""] || FileText;
              return (
                <Card key={doc.id} className="flex items-center gap-2 p-2.5">
                  <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{doc.title}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {doc.file_size && <span>{formatFileSize(doc.file_size)}</span>}
                      {doc.chunk_count > 0 && <span>{doc.chunk_count} chunks</span>}
                    </div>
                  </div>
                  <Badge variant={statusVariants[doc.status]} className="text-[10px] px-1.5 py-0">
                    {(doc.status === "processing" || doc.status === "pending") && (
                      <Loader2 className="mr-0.5 h-2.5 w-2.5 animate-spin" />
                    )}
                    {doc.status}
                  </Badge>
                  <button
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(doc.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onComplete={handleUploadComplete}
        projectId={projectId}
      />
    </div>
  );
}
