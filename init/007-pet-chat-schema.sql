-- Phase 3: pet-scoped AI chat sessions, messages, and evidence traces.
CREATE TABLE IF NOT EXISTS chat_sessions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pet_id BIGINT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '健康咨询',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL CHECK (char_length(trim(content)) BETWEEN 1 AND 8000),
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_sessions_pet_updated_idx ON chat_sessions (pet_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_session_created_idx ON chat_messages (session_id, created_at ASC);

CREATE TABLE IF NOT EXISTS chat_citations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    source_type TEXT NOT NULL CHECK (source_type IN ('log', 'knowledge', 'report')),
    source_id TEXT NOT NULL,
    excerpt TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_citations_message_idx ON chat_citations (message_id, source_type);

DROP TRIGGER IF EXISTS chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER chat_sessions_updated_at
BEFORE UPDATE ON chat_sessions
FOR EACH ROW EXECUTE FUNCTION touch_pet_updated_at();
