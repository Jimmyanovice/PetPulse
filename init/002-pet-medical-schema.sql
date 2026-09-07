-- Structured storage for the reviewed pet-medical knowledge base.
CREATE TABLE IF NOT EXISTS pet_medical_knowledge (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    knowledge_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    species TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    domain TEXT NOT NULL,
    knowledge_type TEXT NOT NULL,
    keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    retrieval_intent TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    source_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    source_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    evidence_type TEXT,
    review_status TEXT NOT NULL DEFAULT 'pending_vet_review',
    commercial_use_status TEXT NOT NULL DEFAULT 'not_cleared',
    clinical_use_boundary TEXT,
    embedding VECTOR(384),
    dataset_version TEXT NOT NULL DEFAULT '2.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pet_medical_embedding_hnsw_idx
    ON pet_medical_knowledge USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS pet_medical_species_gin_idx
    ON pet_medical_knowledge USING gin (species);
CREATE INDEX IF NOT EXISTS pet_medical_keywords_gin_idx
    ON pet_medical_knowledge USING gin (keywords);
CREATE INDEX IF NOT EXISTS pet_medical_metadata_idx
    ON pet_medical_knowledge (domain, risk_level, review_status);

CREATE OR REPLACE FUNCTION touch_pet_medical_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pet_medical_updated_at ON pet_medical_knowledge;
CREATE TRIGGER pet_medical_updated_at
BEFORE UPDATE ON pet_medical_knowledge
FOR EACH ROW EXECUTE FUNCTION touch_pet_medical_updated_at();
