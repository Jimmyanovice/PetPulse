-- Isolated final corpus. Existing pets, reports and earlier knowledge remain recoverable.
CREATE TABLE IF NOT EXISTS rag_datasets (
    version TEXT PRIMARY KEY, sha256 TEXT NOT NULL, filename TEXT NOT NULL,
    metadata JSONB NOT NULL, imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS rag_cards (
    dataset_version TEXT NOT NULL REFERENCES rag_datasets(version),
    knowledge_id TEXT NOT NULL, species TEXT[] NOT NULL,
    payload JSONB NOT NULL, embedding HALFVEC(3072),
    embedding_model TEXT, PRIMARY KEY (dataset_version, knowledge_id)
);
CREATE INDEX IF NOT EXISTS rag_cards_species_idx ON rag_cards USING gin(species);
CREATE INDEX IF NOT EXISTS rag_cards_vector_idx ON rag_cards USING hnsw(embedding halfvec_cosine_ops);
ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_species_check;
ALTER TABLE pets ADD CONSTRAINT pets_species_check CHECK (species IN ('cat','dog','rabbit'));
