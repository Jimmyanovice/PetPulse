CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding VECTOR(384),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX documents_embedding_hnsw_idx
    ON documents USING hnsw (embedding vector_cosine_ops);

CREATE INDEX documents_metadata_gin_idx
    ON documents USING gin (metadata);
