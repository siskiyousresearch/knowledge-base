"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatMessage, ChunkSearchResult, Conversation } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import {
  Send,
  Plus,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Trash2,
  Loader2,
} from "lucide-react";

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      if (Array.isArray(data)) setConversations(data);
    } finally {
      setLoadingConvos(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  async function loadConversation(id: string) {
    setActiveId(id);
    const res = await fetch(`/api/conversations/${id}`);
    const data = await res.json();
    setMessages(data.messages || []);
  }

  async function createConversation() {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    setConversations((prev) => [data, ...prev]);
    setActiveId(data.id);
    setMessages([]);
  }

  async function deleteConversation(id: string) {
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
  }

  async function sendMessage() {
    if (!input.trim() || streaming) return;

    let convId = activeId;
    if (!convId) {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      convId = data.id;
      setActiveId(convId);
      setConversations((prev) => [data, ...prev]);
    }

    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, conversationId: convId }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let sources: ChunkSearchResult[] = [];

      const assistantMsg: ChatMessage = { role: "assistant", content: "" };
      setMessages((prev) => [...prev, assistantMsg]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              assistantContent += parsed.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                  sources,
                };
                return updated;
              });
            }
            if (parsed.sources) {
              sources = parsed.sources;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                  sources,
                };
                return updated;
              });
            }
          } catch {
            // Skip malformed data
          }
        }
      }

      // Update conversation title if first message
      if (newMessages.length === 1) {
        fetchConversations();
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex h-full -m-6">
      {/* Conversation list */}
      <div className="w-64 border-r border-border bg-card p-3 flex flex-col">
        <Button className="mb-3 w-full" size="sm" onClick={createConversation}>
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
        <div className="flex-1 space-y-1 overflow-auto">
          {loadingConvos ? (
            [1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)
          ) : conversations.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No conversations yet
            </p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors",
                  activeId === conv.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent"
                )}
                onClick={() => loadConversation(conv.id)}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate flex-1">{conv.title}</span>
                <button
                  className="hidden shrink-0 group-hover:block"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {!activeId && messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h2 className="mb-2 text-lg font-semibold">Chat with your Knowledge Base</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Ask questions about your uploaded documents.
              </p>
              <Button onClick={createConversation}>
                <Plus className="h-4 w-4" />
                Start a Conversation
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-auto p-6 space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-xl px-4 py-3",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                        {msg.sources && msg.sources.length > 0 && (
                          <SourcesCollapsible sources={msg.sources} />
                        )}
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {streaming && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex justify-start">
                  <div className="rounded-xl bg-muted px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border bg-card p-4">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question about your documents..."
                  className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  rows={1}
                  disabled={streaming}
                />
                <Button
                  size="icon"
                  onClick={sendMessage}
                  disabled={!input.trim() || streaming}
                >
                  {streaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SourcesCollapsible({ sources }: { sources: ChunkSearchResult[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3 border-t border-border pt-2">
      <button
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {sources.length} source{sources.length !== 1 ? "s" : ""}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {sources.map((source, i) => (
            <Card key={i} className="p-3 text-xs">
              <p className="mb-1 font-medium">
                {source.document_title}
                <span className="ml-2 text-muted-foreground">
                  ({(source.similarity * 100).toFixed(0)}% match)
                </span>
              </p>
              <p className="text-muted-foreground line-clamp-3">{source.content}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
