"use client";

import { useState, useRef } from "react";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALL_EXTENSIONS } from "@/lib/constants";
import { Upload, Globe, Loader2, CheckCircle, XCircle, File, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { DocumentCategory } from "@/lib/templates";

type Tab = "file" | "url" | "bulk";

interface FileUploadState {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
  category?: string;
}

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  projectId?: string;
  documentCategories?: DocumentCategory[];
}

function getFileExtension(name: string): string {
  const match = name.match(/\.[^.]+$/);
  return match ? match[0].toLowerCase() : "";
}

export function UploadDialog({ open, onClose, onComplete, projectId, documentCategories }: UploadDialogProps) {
  const [tab, setTab] = useState<Tab>("file");
  const [files, setFiles] = useState<FileUploadState[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [url, setUrl] = useState("");
  const [urlState, setUrlState] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [urlError, setUrlError] = useState("");
  const [crawlDepth, setCrawlDepth] = useState(0);
  const [maxPages, setMaxPages] = useState(100);
  const [bulkUrls, setBulkUrls] = useState("");
  const [bulkState, setBulkState] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [bulkResult, setBulkResult] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasCategories = documentCategories && documentCategories.length > 0;

  function reset() {
    setFiles([]);
    setUploading(false);
    setSelectedCategory("");
    setUrl("");
    setUrlState("idle");
    setUrlError("");
    setBulkUrls("");
    setBulkState("idle");
    setBulkResult("");
    setDragOver(false);
  }

  function handleClose() {
    if (uploading) return;
    reset();
    onClose();
  }

  function addFiles(newFiles: FileList | File[]) {
    const fileArray = Array.from(newFiles);
    const newStates: FileUploadState[] = fileArray.map((f) => ({
      file: f,
      status: "pending" as const,
    }));
    setFiles((prev) => [...prev, ...newStates]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function uploadAllFiles() {
    if (files.length === 0) return;
    setUploading(true);

    let allDone = true;

    for (let i = 0; i < files.length; i++) {
      if (files[i].status === "done") continue;

      setFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status: "uploading" as const } : f))
      );

      try {
        const file = files[i].file;
        const extension = getFileExtension(file.name);

        // Step 1: Create DB record
        const metadata: Record<string, unknown> = {};
        if (selectedCategory) metadata.category = selectedCategory;

        const createRes = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: extension,
            fileSize: file.size,
            projectId,
            metadata,
          }),
        });

        if (!createRes.ok) {
          const data = await createRes.json().catch(() => ({}));
          throw new Error(data.error || `Record creation failed (${createRes.status})`);
        }

        const doc = await createRes.json();

        // Step 2: Get signed upload URL
        const urlRes = await fetch("/api/documents/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: doc.id, fileName: file.name }),
        });

        if (!urlRes.ok) {
          const data = await urlRes.json().catch(() => ({}));
          throw new Error(data.error || `Upload URL failed (${urlRes.status})`);
        }

        const { signedUrl, storagePath } = await urlRes.json();

        // Step 3: Upload file directly to Supabase Storage via signed URL
        const uploadRes = await fetch(signedUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            "x-upsert": "true",
          },
          body: file,
        });

        if (!uploadRes.ok) {
          const text = await uploadRes.text();
          throw new Error(`Storage upload failed: ${text}`);
        }

        // Step 4: Confirm upload — save storagePath so queue processor can pick it up
        const confirmRes = await fetch(`/api/documents/${doc.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storagePath }),
        });

        if (!confirmRes.ok) {
          const data = await confirmRes.json().catch(() => ({}));
          throw new Error(data.error || "Failed to confirm upload");
        }

        setFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: "done" as const } : f))
        );
      } catch (err) {
        allDone = false;
        const msg = err instanceof Error ? err.message : "Upload failed";
        setFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: "error" as const, error: msg } : f))
        );
      }
    }

    setUploading(false);

    if (allDone) {
      setTimeout(() => {
        onComplete();
      }, 500);
    }
  }

  async function handleUrlSubmit() {
    if (!url.trim()) return;
    setUrlState("processing");
    setUrlError("");

    try {
      if (crawlDepth > 0) {
        // Use crawl endpoint for multi-page crawling
        const res = await fetch("/api/documents/crawl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim(), maxDepth: crawlDepth, maxPages, projectId }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Crawl failed");
        }

        const data = await res.json();
        setUrlState("done");
        setUrlError(`Found ${data.pagesFound} pages. Processing will begin automatically.`);
        setTimeout(onComplete, 2000);
      } else {
        // Single page scrape
        const res = await fetch("/api/documents/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim(), projectId }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Scraping failed");
        }

        setUrlState("done");
        setTimeout(onComplete, 1000);
      }
    } catch (err) {
      setUrlState("error");
      setUrlError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const parsedBulkUrls = bulkUrls
    .split("\n")
    .map((u) => u.trim())
    .filter((u) => u && u.startsWith("http"));

  async function handleBulkSubmit() {
    if (parsedBulkUrls.length === 0) return;
    setBulkState("processing");
    setBulkResult("");

    try {
      const res = await fetch("/api/documents/bulk-urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: parsedBulkUrls, projectId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Bulk URL submission failed");
      }

      const data = await res.json();
      setBulkState("done");
      setBulkResult(`${data.queued} URL${data.queued !== 1 ? "s" : ""} queued${data.skipped > 0 ? ` (${data.skipped} duplicates skipped)` : ""}. Processing will begin automatically.`);
      setTimeout(onComplete, 2000);
    } catch (err) {
      setBulkState("error");
      setBulkResult(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  }

  const pendingCount = files.filter((f) => f.status === "pending" || f.status === "error").length;
  const doneCount = files.filter((f) => f.status === "done").length;
  const errorCount = files.filter((f) => f.status === "error").length;

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Add Documents</DialogTitle>

      <div className="mt-4 flex gap-1 rounded-lg bg-muted p-1">
        <button
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "file" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setTab("file")}
        >
          <Upload className="mr-1.5 inline-block h-4 w-4" />
          Upload Files
        </button>
        <button
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "url" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setTab("url")}
        >
          <Globe className="mr-1.5 inline-block h-4 w-4" />
          Add URL
        </button>
        <button
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "bulk" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setTab("bulk")}
        >
          <List className="mr-1.5 inline-block h-4 w-4" />
          Bulk URLs
        </button>
      </div>

      <div className="mt-4">
        {tab === "bulk" ? (
          bulkState === "done" ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle className="mb-2 h-10 w-10 text-status-completed" />
              <p className="font-medium">URLs queued!</p>
              <p className="mt-1 text-sm text-muted-foreground">{bulkResult}</p>
            </div>
          ) : bulkState === "error" ? (
            <div className="flex flex-col items-center py-8 text-center">
              <XCircle className="mb-2 h-10 w-10 text-status-failed" />
              <p className="mb-2 font-medium">Something went wrong</p>
              <p className="mb-4 text-sm text-muted-foreground">{bulkResult}</p>
              <Button variant="outline" onClick={() => setBulkState("idle")}>Try Again</Button>
            </div>
          ) : bulkState === "processing" ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Loader2 className="mb-2 h-10 w-10 animate-spin text-primary" />
              <p className="font-medium">Queueing URLs...</p>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                placeholder={"Paste URLs, one per line:\nhttps://example.com/page1\nhttps://example.com/page2\nhttps://example.com/page3"}
                value={bulkUrls}
                onChange={(e) => setBulkUrls(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                rows={8}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {parsedBulkUrls.length > 0
                    ? `${parsedBulkUrls.length} valid URL${parsedBulkUrls.length !== 1 ? "s" : ""} detected`
                    : "Enter URLs starting with http:// or https://"}
                </p>
                <Button onClick={handleBulkSubmit} disabled={parsedBulkUrls.length === 0}>
                  <List className="h-4 w-4" />
                  Add {parsedBulkUrls.length > 0 ? parsedBulkUrls.length : ""} URL{parsedBulkUrls.length !== 1 ? "s" : ""}
                </Button>
              </div>
            </div>
          )
        ) : tab === "file" ? (
          <div className="space-y-3">
            {hasCategories && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground whitespace-nowrap">Category:</label>
                <select
                  className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">No category</option>
                  {documentCategories!.map((cat) => (
                    <option key={cat.name} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Drop files here or click to browse</p>
              <p className="mt-1 text-xs text-muted-foreground">
                PDF, DOCX, TXT, MD, CSV, XLSX, PPTX, PNG, JPG, GIF, WEBP (max 50MB each)
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={ALL_EXTENSIONS.join(",")}
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            {files.length > 0 && (
              <div className="max-h-60 space-y-1.5 overflow-y-auto">
                {files.map((f, i) => (
                  <div
                    key={`${f.file.name}-${i}`}
                    className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    {f.status === "done" ? (
                      <CheckCircle className="h-4 w-4 shrink-0 text-status-completed" />
                    ) : f.status === "error" ? (
                      <XCircle className="h-4 w-4 shrink-0 text-status-failed" />
                    ) : f.status === "uploading" ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                    ) : (
                      <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex-1 truncate" title={f.error}>{f.file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(f.file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    {f.status === "pending" && !uploading && (
                      <button
                        className="text-xs text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {files.length > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {uploading
                    ? `Uploading... ${doneCount}/${files.length}`
                    : doneCount === files.length && doneCount > 0
                      ? `All ${doneCount} files uploaded! Processing will begin automatically.`
                      : `${files.length} file${files.length !== 1 ? "s" : ""} selected`}
                  {errorCount > 0 && ` (${errorCount} failed)`}
                </p>
                <div className="flex gap-2">
                  {doneCount === files.length && doneCount > 0 ? (
                    <Button size="sm" onClick={() => onComplete()}>
                      Done
                    </Button>
                  ) : (
                    <>
                      {!uploading && (
                        <Button size="sm" variant="outline" onClick={reset}>
                          Clear
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={uploadAllFiles}
                        disabled={uploading || pendingCount === 0}
                      >
                        {uploading && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                        Upload {pendingCount > 0 ? pendingCount : ""} File{pendingCount !== 1 ? "s" : ""}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          urlState === "done" ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle className="mb-2 h-10 w-10 text-status-completed" />
              <p className="font-medium">URL added successfully!</p>
            </div>
          ) : urlState === "error" ? (
            <div className="flex flex-col items-center py-8 text-center">
              <XCircle className="mb-2 h-10 w-10 text-status-failed" />
              <p className="mb-2 font-medium">Something went wrong</p>
              <p className="mb-4 text-sm text-muted-foreground">{urlError}</p>
              <Button variant="outline" onClick={() => setUrlState("idle")}>Try Again</Button>
            </div>
          ) : urlState === "processing" ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Loader2 className="mb-2 h-10 w-10 animate-spin text-primary" />
              <p className="font-medium">Scraping URL...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {hasCategories && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-muted-foreground whitespace-nowrap">Category:</label>
                  <select
                    className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="">No category</option>
                    {documentCategories!.map((cat) => (
                      <option key={cat.name} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <Input
                placeholder="https://example.com/article or Google Drive share link"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && crawlDepth === 0 && handleUrlSubmit()}
              />
              <div className="flex items-center gap-3">
                <label className="text-sm text-muted-foreground whitespace-nowrap">Crawl depth:</label>
                <select
                  className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                  value={crawlDepth}
                  onChange={(e) => setCrawlDepth(Number(e.target.value))}
                >
                  <option value={0}>Single page only</option>
                  <option value={1}>1 level deep</option>
                  <option value={2}>2 levels deep</option>
                  <option value={3}>3 levels deep</option>
                  <option value={99}>Entire site (unlimited depth)</option>
                </select>
              </div>
              {crawlDepth > 0 && (
                <div className="flex items-center gap-3">
                  <label className="text-sm text-muted-foreground whitespace-nowrap">Max pages:</label>
                  <Input
                    type="number"
                    min={1}
                    max={5000}
                    value={maxPages}
                    onChange={(e) => setMaxPages(Math.min(5000, Math.max(1, Number(e.target.value))))}
                    className="flex-1"
                  />
                  {maxPages > 500 && (
                    <span className="text-xs text-yellow-600">Large crawl — may take a while</span>
                  )}
                </div>
              )}
              <Button className="w-full" onClick={handleUrlSubmit} disabled={!url.trim()}>
                <Globe className="h-4 w-4" />
                {crawlDepth > 0 ? (crawlDepth >= 99 ? `Crawl Entire Site (up to ${maxPages} pages)` : `Crawl Site (up to ${maxPages} pages)`) : "Scrape & Add"}
              </Button>
            </div>
          )
        )}
      </div>
    </Dialog>
  );
}
