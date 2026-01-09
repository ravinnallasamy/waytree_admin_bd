-- Add useful columns that might be missing if relying solely on JSONB
-- This ensures 'chunk_index' is a first-class citizen for ordering,
-- and 'source_path' helps identify which file the chunk came from.

ALTER TABLE event_embeddings 
ADD COLUMN IF NOT EXISTS chunk_index integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS source_path text;

-- Verify content column exists (It holds the actual text chunk)
-- ALTER TABLE event_embeddings ADD COLUMN IF NOT EXISTS content text;
