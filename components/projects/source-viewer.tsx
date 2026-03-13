"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";

interface SourceViewerProps {
  documentId: string | null;
  onClose: () => void;
}

export function SourceViewer({ documentId, onClose }: SourceViewerProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!documentId) return;

    setLoading(true);
    setTitle("");
    setContent("");

    fetch(`/api/documents/${documentId}/content`)
      .then((res) => res.json())
      .then((data) => {
        setTitle(data.title || "Untitled Document");
        setContent(data.content || "");
      })
      .catch(() => {
        setContent("Failed to load document content.");
      })
      .finally(() => setLoading(false));
  }, [documentId]);

  return (
    <Dialog open={!!documentId} onClose={onClose} className="max-w-2xl">
      <DialogTitle>{loading ? "Loading..." : title}</DialogTitle>

      <div className="mt-4 max-h-[60vh] overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="whitespace-pre-wrap text-sm text-foreground">
            {content}
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button variant="outline" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
          Close
        </Button>
      </div>
    </Dialog>
  );
}
