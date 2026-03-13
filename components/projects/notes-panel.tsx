"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Note } from "@/lib/types";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  StickyNote,
  Loader2,
} from "lucide-react";

interface NotesPanelProps {
  projectId: string;
}

export function NotesPanel({ projectId }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/notes?projectId=${projectId}`);
      const data = await res.json();
      if (Array.isArray(data)) setNotes(data);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  async function handleCreate() {
    if (!newContent.trim()) return;
    setSaving(true);

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: newTitle.trim() || null,
          content: newContent.trim(),
          sourceType: "manual",
        }),
      });

      if (res.ok) {
        setNewTitle("");
        setNewContent("");
        setCreating(false);
        fetchNotes();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string) {
    if (!editContent.trim()) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim() || null,
          content: editContent.trim(),
        }),
      });

      if (res.ok) {
        setEditingId(null);
        fetchNotes();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this note?")) return;

    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  function startEditing(note: Note) {
    setEditingId(note.id);
    setEditTitle(note.title || "");
    setEditContent(note.content);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border p-3">
        <h3 className="text-sm font-semibold">Notes</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setCreating(true);
            setNewTitle("");
            setNewContent("");
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Note
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-2">
        {creating && (
          <Card className="p-3 space-y-2">
            <Input
              placeholder="Title (optional)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <Textarea
              placeholder="Write your note..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCreating(false)}
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!newContent.trim() || saving}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save
              </Button>
            </div>
          </Card>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : notes.length === 0 && !creating ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <StickyNote className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="mb-1 text-sm font-medium">No notes yet</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Create notes to capture your thoughts and insights.
            </p>
            <Button
              size="sm"
              onClick={() => {
                setCreating(true);
                setNewTitle("");
                setNewContent("");
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Note
            </Button>
          </div>
        ) : (
          notes.map((note) =>
            editingId === note.id ? (
              <Card key={note.id} className="p-3 space-y-2">
                <Input
                  placeholder="Title (optional)"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={4}
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={cancelEditing}>
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleUpdate(note.id)}
                    disabled={!editContent.trim() || saving}
                  >
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Save
                  </Button>
                </div>
              </Card>
            ) : (
              <Card key={note.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {note.title && (
                      <p className="text-sm font-medium truncate">{note.title}</p>
                    )}
                    <p
                      className={cn(
                        "text-xs text-muted-foreground line-clamp-3",
                        !note.title && "text-sm text-foreground"
                      )}
                    >
                      {note.content}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      className="rounded p-1 text-muted-foreground hover:text-foreground"
                      onClick={() => startEditing(note)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(note.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            )
          )
        )}
      </div>
    </div>
  );
}
