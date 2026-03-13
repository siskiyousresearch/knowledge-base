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

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const processingRef = useRef<Set<string>>(new Set());

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      if (Array.isArray(data)) setDocuments(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Background queue processor: picks up pending docs and processes them one at a time
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
          // URL documents: use scrape endpoint
          const url = (doc.metadata?.url as string) || doc.file_name;
          await fetch("/api/documents/scrape", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              documentId: doc.id,
              url,
              crawlJobId: doc.crawl_job_id,
              crawlDepth: doc.crawl_depth,
            }),
          });
        } else {
          // File documents: use process endpoint
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

    // Small delay to let any in-flight uploads finish
    const timer = setTimeout(processNext, 2000);
    return () => clearTimeout(timer);
  }, [documents, fetchDocuments]);

  // Poll while there are pending or processing documents
  useEffect(() => {
    const hasActive = documents.some((d) => d.status === "processing" || d.status === "pending");
    if (!hasActive) return;
    const interval = setInterval(fetchDocuments, 3000);
    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this document and all its chunks?")) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  function handleUploadComplete() {
    setUploadOpen(false);
    fetchDocuments();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {documents.length} document{documents.length !== 1 ? "s" : ""} in knowledge base
          </p>
        </div>
        <Button onClick={() => setUploadOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Documents
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No documents yet</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Upload documents or add URLs to build your knowledge base.
          </p>
          <Button onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Your First Documents
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const Icon = fileTypeIcons[doc.file_type || ""] || FileText;
            return (
              <Card key={doc.id} className="flex items-center gap-4 p-4">
                <Icon className="h-8 w-8 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.title}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span>{formatDate(doc.created_at)}</span>
                    {doc.chunk_count > 0 && <span>{doc.chunk_count} chunks</span>}
                    {doc.error_message && (
                      <span className="text-status-failed truncate max-w-[200px]" title={doc.error_message}>
                        {doc.error_message}
                      </span>
                    )}
                  </div>
                </div>
                <Badge variant={statusVariants[doc.status]}>
                  {(doc.status === "processing" || doc.status === "pending") && (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  {doc.status}
                </Badge>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(doc.id)} title="Delete document">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onComplete={handleUploadComplete}
      />
    </div>
  );
}
