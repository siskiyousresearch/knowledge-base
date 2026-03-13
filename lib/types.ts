export interface Project {
  id: string;
  title: string;
  description: string | null;
  document_count?: number;
  created_at: string;
  updated_at: string;
}

export type DocumentSource = "upload" | "url" | "google_drive";
export type DocumentStatus = "pending" | "processing" | "completed" | "failed";

export interface Document {
  id: string;
  title: string;
  source: DocumentSource;
  status: DocumentStatus;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  content_hash: string | null;
  chunk_count: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
  project_id: string | null;
  crawl_job_id: string | null;
  crawl_depth: number;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  embedding: number[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ChunkSearchResult {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  similarity: number;
  document_title?: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  sources?: ChunkSearchResult[];
  created_at?: string;
}

export interface Conversation {
  id: string;
  title: string;
  project_id: string | null;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export type CrawlStatus = "running" | "completed" | "cancelled" | "failed";

export interface CrawlJob {
  id: string;
  root_url: string;
  max_depth: number;
  max_pages: number;
  pages_found: number;
  pages_completed: number;
  pages_failed: number;
  status: CrawlStatus;
  created_at: string;
  updated_at: string;
}

export interface UsageLog {
  id: string;
  conversation_id: string | null;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  created_at: string;
}
