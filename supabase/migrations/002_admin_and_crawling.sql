-- Settings key-value store (API keys, budgets, config)
create table knowledge_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create trigger knowledge_settings_updated_at
  before update on knowledge_settings
  for each row execute function knowledge_update_updated_at();

-- Usage logging per chat request
create table knowledge_usage_log (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references knowledge_conversations(id) on delete set null,
  model text not null,
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  total_tokens int not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);

create index on knowledge_usage_log (created_at);

-- Crawl jobs
create type knowledge_crawl_status as enum ('running', 'completed', 'cancelled', 'failed');

create table knowledge_crawl_jobs (
  id uuid primary key default gen_random_uuid(),
  root_url text not null,
  max_depth int not null default 1,
  max_pages int not null default 50,
  pages_found int not null default 0,
  pages_completed int not null default 0,
  pages_failed int not null default 0,
  status knowledge_crawl_status not null default 'running',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger knowledge_crawl_jobs_updated_at
  before update on knowledge_crawl_jobs
  for each row execute function knowledge_update_updated_at();

-- Add crawl columns to documents
alter table knowledge_documents
  add column if not exists crawl_job_id uuid references knowledge_crawl_jobs(id) on delete set null,
  add column if not exists crawl_depth int default 0;

-- Daily usage aggregation RPC
create or replace function knowledge_daily_usage(days int default 30)
returns table (day date, total_tokens bigint, total_cost numeric)
language sql stable as $$
  select
    date(created_at) as day,
    sum(total_tokens)::bigint,
    sum(cost_usd)
  from knowledge_usage_log
  where created_at >= now() - (days || ' days')::interval
  group by date(created_at)
  order by day desc;
$$;
