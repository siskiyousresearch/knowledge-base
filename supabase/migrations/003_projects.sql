-- Projects table
create table knowledge_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger knowledge_projects_updated_at
  before update on knowledge_projects
  for each row execute function knowledge_update_updated_at();

-- Add project_id to documents and conversations
alter table knowledge_documents
  add column if not exists project_id uuid references knowledge_projects(id) on delete cascade;

alter table knowledge_conversations
  add column if not exists project_id uuid references knowledge_projects(id) on delete cascade;

create index if not exists idx_documents_project_id on knowledge_documents(project_id);
create index if not exists idx_conversations_project_id on knowledge_conversations(project_id);

-- Project-scoped vector search RPC
create or replace function knowledge_match_chunks_by_project(
  p_project_id uuid,
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
  inner join knowledge_documents d on d.id = dc.document_id
  where d.project_id = p_project_id
    and dc.embedding is not null
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
