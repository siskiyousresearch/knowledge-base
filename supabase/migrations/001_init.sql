-- Enable vector extension
create extension if not exists vector with schema extensions;

-- Document source and status enums (prefixed to avoid conflicts)
create type knowledge_document_source as enum ('upload', 'url', 'google_drive');
create type knowledge_document_status as enum ('pending', 'processing', 'completed', 'failed');

-- Documents table
create table knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source knowledge_document_source not null default 'upload',
  status knowledge_document_status not null default 'pending',
  file_name text,
  file_type text,
  file_size bigint,
  content_hash text,
  chunk_count int not null default 0,
  error_message text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Document chunks table
create table knowledge_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references knowledge_documents(id) on delete cascade,
  chunk_index int not null,
  content text not null,
  token_count int not null default 0,
  embedding vector(384),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- HNSW index for fast vector similarity search
create index on knowledge_document_chunks using hnsw (embedding vector_cosine_ops);

-- Index for looking up chunks by document
create index on knowledge_document_chunks (document_id);

-- Conversations table
create table knowledge_conversations (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'New Conversation',
  messages jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-update updated_at trigger
create or replace function knowledge_update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger knowledge_documents_updated_at
  before update on knowledge_documents
  for each row execute function knowledge_update_updated_at();

create trigger knowledge_conversations_updated_at
  before update on knowledge_conversations
  for each row execute function knowledge_update_updated_at();

-- Vector similarity search RPC function
create or replace function knowledge_match_chunks(
  query_embedding vector(384),
  match_threshold float default 0.5,
  match_count int default 5
)
returns table (
  id uuid,
  document_id uuid,
  chunk_index int,
  content text,
  similarity float
)
language sql stable
as $$
  select
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from knowledge_document_chunks dc
  where dc.embedding is not null
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
