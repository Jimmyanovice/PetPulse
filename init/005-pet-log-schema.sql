-- Phase 1: pet profiles and owner-authored health logs.
CREATE TABLE IF NOT EXISTS pets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 80),
    species TEXT NOT NULL CHECK (species IN ('cat', 'dog')),
    breed TEXT,
    birth_date DATE,
    sex TEXT CHECK (sex IN ('female', 'male', 'unknown')),
    neutered BOOLEAN,
    weight_kg NUMERIC(6, 2) CHECK (weight_kg > 0 AND weight_kg < 300),
    allergies TEXT,
    chronic_conditions TEXT,
    current_medications TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pet_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pet_id BIGINT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    content TEXT NOT NULL CHECK (char_length(trim(content)) BETWEEN 1 AND 4000),
    log_type TEXT NOT NULL DEFAULT 'daily' CHECK (log_type IN ('daily', 'symptom', 'medication', 'visit', 'measurement')),
    structured_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    ai_extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pet_logs_pet_time_idx ON pet_logs (pet_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS pet_logs_type_idx ON pet_logs (pet_id, log_type, logged_at DESC);
CREATE INDEX IF NOT EXISTS pet_logs_structured_data_gin_idx ON pet_logs USING gin (structured_data);

CREATE OR REPLACE FUNCTION touch_pet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pets_updated_at ON pets;
CREATE TRIGGER pets_updated_at
BEFORE UPDATE ON pets
FOR EACH ROW EXECUTE FUNCTION touch_pet_updated_at();

DROP TRIGGER IF EXISTS pet_logs_updated_at ON pet_logs;
CREATE TRIGGER pet_logs_updated_at
BEFORE UPDATE ON pet_logs
FOR EACH ROW EXECUTE FUNCTION touch_pet_updated_at();
