"use client";

import { useEffect, useState, useCallback } from "react";
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
  Trash2,
  RefreshCw,
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

  // Poll for processing documents
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === "processing" || d.status === "pending");
    if (!hasProcessing) return;
    const interval = setInterval(fetchDocuments, 3000);
    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this document and all its chunks?")) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }

  async function handleProcess(id: string) {
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: "processing" as const } : d))
    );
    await fetch("/api/documents/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: id }),
    });
    fetchDocuments();
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
          Add Document
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
            Add Your First Document
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
                  </div>
                </div>
                <Badge variant={statusVariants[doc.status]}>
                  {doc.status === "processing" && (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  {doc.status}
                </Badge>
                <div className="flex items-center gap-1">
                  {doc.status === "pending" && (
                    <Button variant="ghost" size="icon" onClick={() => handleProcess(doc.id)} title="Process document">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
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
