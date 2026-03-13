"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UploadDialog } from "@/components/documents/upload-dialog";
import { Document, DocumentStatus, CrawlJob } from "@/lib/types";
import { formatFileSize } from "@/lib/utils";
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
  XCircle,
  RefreshCw,
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
  onViewDocument?: (documentId: string) => void;
}

export function SourcesPanel({ projectId, onViewDocument }: SourcesPanelProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [crawlJobs, setCrawlJobs] = useState<CrawlJob[]>([]);
  const processingRef = useRef<Set<string>>(new Set());
  const resumedRef = useRef(false);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents?projectId=${projectId}`);
      const data = await res.json();
      if (Array.isArray(data)) setDocuments(data);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Fetch active crawl jobs for this project's documents
  const fetchCrawlJobs = useCallback(async () => {
    // Get unique crawl job IDs from documents
    const jobIds = [...new Set(documents.filter((d) => d.crawl_job_id).map((d) => d.crawl_job_id!))];
    if (jobIds.length === 0) {
      setCrawlJobs([]);
      return;
    }

    const jobs: CrawlJob[] = [];
    for (const id of jobIds) {
      try {
        const res = await fetch(`/api/documents/crawl/${id}`);
        if (res.ok) {
          const job = await res.json();
          if (job.status === "running") {
            jobs.push(job);
          }
        }
      } catch {
        // Skip failed fetches
      }
    }
    setCrawlJobs(jobs);
  }, [documents]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Auto-resume: reset stalled "processing" docs back to "pending" on first load
  useEffect(() => {
    if (resumedRef.current || loading) return;
    resumedRef.current = true;

    fetch("/api/documents/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    }).then(() => fetchDocuments());
  }, [loading, projectId, fetchDocuments]);

  // Fetch crawl jobs when documents change
  useEffect(() => {
    fetchCrawlJobs();
  }, [fetchCrawlJobs]);

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

  async function cancelCrawl(jobId: string) {
    if (!confirm("Cancel this crawl? Completed pages will be kept.")) return;
    await fetch(`/api/documents/crawl/${jobId}`, { method: "DELETE" });
    fetchDocuments();
  }

  function handleUploadComplete() {
    setUploadOpen(false);
    fetchDocuments();
  }

  // Calculate progress stats
  const totalDocs = documents.length;
  const completedDocs = documents.filter((d) => d.status === "completed").length;
  const failedDocs = documents.filter((d) => d.status === "failed").length;
  const pendingDocs = documents.filter((d) => d.status === "pending").length;
  const processingDocs = documents.filter((d) => d.status === "processing").length;
  const activeDocs = pendingDocs + processingDocs;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold">Sources</h3>
          <p className="text-xs text-muted-foreground">
            {completedDocs} of {totalDocs} source{totalDocs !== 1 ? "s" : ""} ready
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setUploadOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {/* Progress bar for active processing */}
      {activeDocs > 0 && (
        <div className="px-3 py-2 border-b border-border bg-accent/30">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="text-xs font-medium">
                Processing {completedDocs + failedDocs} / {totalDocs}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {pendingDocs} queued{processingDocs > 0 ? `, ${processingDocs} active` : ""}
              {failedDocs > 0 ? `, ${failedDocs} failed` : ""}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full flex">
              <div
                className="bg-primary transition-all duration-500"
                style={{ width: `${totalDocs > 0 ? (completedDocs / totalDocs) * 100 : 0}%` }}
              />
              {failedDocs > 0 && (
                <div
                  className="bg-destructive transition-all duration-500"
                  style={{ width: `${(failedDocs / totalDocs) * 100}%` }}
                />
              )}
            </div>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {Math.round(((completedDocs + failedDocs) / totalDocs) * 100)}% complete
            {" "}&middot; Close and reopen to resume anytime
          </p>
        </div>
      )}

      {/* Active crawl jobs */}
      {crawlJobs.map((job) => (
        <div key={job.id} className="px-3 py-2 border-b border-border bg-blue-50 dark:bg-blue-950/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Globe className="h-3 w-3 text-blue-600" />
              <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Crawling</span>
            </div>
            <button
              onClick={() => cancelCrawl(job.id)}
              className="text-[10px] text-muted-foreground hover:text-destructive"
            >
              Cancel
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{job.root_url}</p>
          <p className="text-[10px] text-muted-foreground">
            {job.pages_completed} / {job.pages_found} pages
            {job.pages_failed > 0 && ` (${job.pages_failed} failed)`}
            {" "}&middot; depth {job.max_depth >= 99 ? "unlimited" : job.max_depth}
          </p>
        </div>
      ))}

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
                <Card
                  key={doc.id}
                  className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => doc.status === "completed" && onViewDocument?.(doc.id)}
                >
                  <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{doc.title}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {doc.file_size && <span>{formatFileSize(doc.file_size)}</span>}
                      {doc.chunk_count > 0 && <span>{doc.chunk_count} chunks</span>}
                      {doc.error_message && (
                        <span className="text-destructive truncate max-w-[120px]" title={doc.error_message}>
                          {doc.error_message}
                        </span>
                      )}
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
