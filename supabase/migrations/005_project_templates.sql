-- Add template column to knowledge_projects
ALTER TABLE knowledge_projects ADD COLUMN IF NOT EXISTS template TEXT DEFAULT 'general';
