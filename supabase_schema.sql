-- 1. Enable the pgvector extension to work with embeddings
-- This is required for the 'vector' data type.
create extension if not exists vector;

-- 2. Create the unified table for Event Embeddings
-- This table stores everything: Metadata, Document Chunks, and Member Profiles
create table if not exists event_embeddings (
  id uuid primary key default gen_random_uuid(),
  
  -- Links to your MongoDB Event ID (or Member ID in specific contexts, but usually grouped by event)
  event_id text not null, 
  
  -- Category of the embedding: 'meta', 'member', or 'doc'
  category text not null check (category in ('meta', 'member', 'doc')), 
  
  -- The actual text chunk used for RAG generation (or bio for members)
  content text not null, 
  
  -- The vector embedding (Gemini Text Embedding 004 is 768 dimensions)
  embedding vector(768), 
  
  -- Extra structured data JSONB is powerful!
  -- For members: { "user_id": "123", "name": "...", "company": "...", "role": "..." }
  -- For docs: { "chunk_index": 5, "source_file": "agenda.pdf" }
  extra_metadata jsonb default '{}'::jsonb,
  
  created_at timestamp with time zone default now()
);

-- 3. Create an Index for fast similarity search using HNSW
create index on event_embeddings using hnsw (embedding vector_cosine_ops);

-- 4. (Optional) Row Level Security if you plan to access this from frontend directly
-- alter table event_embeddings enable row level security;
-- create policy "Public Read" on event_embeddings for select using (true);

-- 5. FUNCTION: Match Embeddings (Semantic Search)
-- Key logic: You pass in a vector, match_threshold, match_count, and filtered category
create or replace function match_event_embeddings (
  query_embedding vector(768),
  similarity_threshold float,
  match_count int,
  filter_event_id text,
  filter_category text
)
returns table (
  id uuid,
  content text,
  similarity float,
  extra_metadata jsonb
)
language plpgsql
as $$
begin
  return query
  select
    event_embeddings.id,
    event_embeddings.content,
    1 - (event_embeddings.embedding <=> query_embedding) as similarity,
    event_embeddings.extra_metadata
  from event_embeddings
  where 1 - (event_embeddings.embedding <=> query_embedding) > similarity_threshold
  and event_embeddings.event_id = filter_event_id
  and event_embeddings.category = filter_category
  order by event_embeddings.embedding <=> query_embedding
  limit match_count;
end;
$$;
