-- Notes table
CREATE TABLE knowledge_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES knowledge_projects(id) ON DELETE CASCADE,
  title text,
  content text NOT NULL,
  source_type text CHECK (source_type IN ('manual', 'ai_generated', 'snippet')),
  source_chunk_id uuid REFERENCES knowledge_document_chunks(id) ON DELETE SET NULL,
  source_document_id uuid REFERENCES knowledge_documents(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_knowledge_notes_project ON knowledge_notes(project_id);

CREATE TRIGGER knowledge_notes_updated_at
  BEFORE UPDATE ON knowledge_notes
  FOR EACH ROW EXECUTE FUNCTION knowledge_update_updated_at();

-- Document tags
CREATE TABLE knowledge_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES knowledge_projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#6b7280',
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, name)
);

CREATE TABLE knowledge_document_tags (
  document_id uuid NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES knowledge_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, tag_id)
);

CREATE INDEX idx_knowledge_tags_project ON knowledge_tags(project_id);

-- Sharing
ALTER TABLE knowledge_projects ADD COLUMN IF NOT EXISTS share_id text UNIQUE;
ALTER TABLE knowledge_projects ADD COLUMN IF NOT EXISTS is_shared boolean DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_knowledge_projects_share ON knowledge_projects(share_id) WHERE share_id IS NOT NULL;

-- Multi-model per project
ALTER TABLE knowledge_projects ADD COLUMN IF NOT EXISTS model_id text;

-- Generated artifacts (study guides, summaries, FAQs)
CREATE TABLE knowledge_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES knowledge_projects(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('summary', 'faq', 'study_guide', 'briefing')),
  title text NOT NULL,
  content text NOT NULL,
  model_used text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_knowledge_artifacts_project ON knowledge_artifacts(project_id);
