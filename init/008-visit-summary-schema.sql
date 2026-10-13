-- Phase 4: reproducible, pet-scoped visit summaries.
CREATE TABLE IF NOT EXISTS visit_summaries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pet_id BIGINT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    log_ids_used BIGINT[] NOT NULL DEFAULT ARRAY[]::BIGINT[],
    report_id_used BIGINT REFERENCES health_reports(id) ON DELETE SET NULL,
    chat_session_id_used BIGINT REFERENCES chat_sessions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS visit_summaries_pet_created_idx ON visit_summaries (pet_id, created_at DESC);

CREATE TABLE IF NOT EXISTS visit_summary_citations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    visit_summary_id BIGINT NOT NULL REFERENCES visit_summaries(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('log', 'report', 'chat')),
    source_id TEXT NOT NULL,
    excerpt TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS visit_summary_citations_summary_idx ON visit_summary_citations (visit_summary_id, source_type);
