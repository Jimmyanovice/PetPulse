-- Phase 2: reproducible health reports and evidence citations.
CREATE TABLE IF NOT EXISTS health_reports (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pet_id BIGINT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    period_days SMALLINT NOT NULL CHECK (period_days IN (7, 14, 30)),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    report_content TEXT NOT NULL,
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    log_ids_used BIGINT[] NOT NULL DEFAULT ARRAY[]::BIGINT[],
    knowledge_ids_used TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    model_name TEXT,
    prompt_version TEXT NOT NULL DEFAULT 'health-report-v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS health_reports_pet_created_idx
    ON health_reports (pet_id, created_at DESC);

CREATE TABLE IF NOT EXISTS health_report_citations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    report_id BIGINT NOT NULL REFERENCES health_reports(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('log', 'knowledge')),
    source_id TEXT NOT NULL,
    excerpt TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS health_report_citations_report_idx
    ON health_report_citations (report_id, source_type);
