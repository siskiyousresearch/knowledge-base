"use client";

import { useState, useRef } from "react";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALL_EXTENSIONS } from "@/lib/constants";
import { Upload, Globe, Loader2, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "file" | "url";
type UploadState = "idle" | "uploading" | "processing" | "done" | "error";

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function UploadDialog({ open, onClose, onComplete }: UploadDialogProps) {
  const [tab, setTab] = useState<Tab>("file");
  const [state, setState] = useState<UploadState>("idle");
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setState("idle");
    setError("");
    setUrl("");
    setDragOver(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function uploadFile(file: File) {
    setState("uploading");
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const text = await uploadRes.text();
        let errorMsg = `Upload failed (${uploadRes.status})`;
        try {
          const data = JSON.parse(text);
          errorMsg = data.error || errorMsg;
        } catch {
          errorMsg = text || errorMsg;
        }
        throw new Error(errorMsg);
      }

      const doc = await uploadRes.json();

      setState("processing");

      const processRes = await fetch("/api/documents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: doc.id }),
      });

      if (!processRes.ok) {
        const text = await processRes.text();
        let errorMsg = `Processing failed (${processRes.status})`;
        try {
          const data = JSON.parse(text);
          errorMsg = data.error || errorMsg;
        } catch {
          errorMsg = text || errorMsg;
        }
        throw new Error(errorMsg);
      }

      setState("done");
      setTimeout(onComplete, 1000);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function handleUrlSubmit() {
    if (!url.trim()) return;
    setState("processing");
    setError("");

    try {
      const res = await fetch("/api/documents/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Scraping failed");
      }

      setState("done");
      setTimeout(onComplete, 1000);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      <DialogTitle>Add Document</DialogTitle>

      <div className="mt-4 flex gap-1 rounded-lg bg-muted p-1">
        <button
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "file" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => { setTab("file"); reset(); }}
        >
          <Upload className="mr-1.5 inline-block h-4 w-4" />
          Upload File
        </button>
        <button
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "url" ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => { setTab("url"); reset(); }}
        >
          <Globe className="mr-1.5 inline-block h-4 w-4" />
          Add URL
        </button>
      </div>

      <div className="mt-4">
        {state === "done" ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle className="mb-2 h-10 w-10 text-status-completed" />
            <p className="font-medium">Document added successfully!</p>
          </div>
        ) : state === "error" ? (
          <div className="flex flex-col items-center py-8 text-center">
            <XCircle className="mb-2 h-10 w-10 text-status-failed" />
            <p className="mb-2 font-medium">Something went wrong</p>
            <p className="mb-4 text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={reset}>Try Again</Button>
          </div>
        ) : state === "uploading" || state === "processing" ? (
          <div className="flex flex-col items-center py-8 text-center">
            <Loader2 className="mb-2 h-10 w-10 animate-spin text-primary" />
            <p className="font-medium">
              {state === "uploading" ? "Uploading..." : "Processing document..."}
            </p>
            <p className="text-sm text-muted-foreground">
              {state === "processing" && "Parsing, chunking, and generating embeddings"}
            </p>
          </div>
        ) : tab === "file" ? (
          <>
            <div
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors",
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
              <p className="text-sm font-medium">Drop a file here or click to browse</p>
              <p className="mt-1 text-xs text-muted-foreground">
                PDF, DOCX, TXT, MD, CSV, XLSX, PPTX, PNG, JPG, GIF, WEBP (max 50MB)
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept={ALL_EXTENSIONS.join(",")}
              className="hidden"
              onChange={handleFileSelect}
            />
          </>
        ) : (
          <div className="space-y-3">
            <Input
              placeholder="https://example.com/article or Google Drive share link"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUrlSubmit()}
            />
            <Button className="w-full" onClick={handleUrlSubmit} disabled={!url.trim()}>
              <Globe className="h-4 w-4" />
              Scrape & Add
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
