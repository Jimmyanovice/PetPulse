"""Idempotently import the versioned pet-medical JSON dataset into PostgreSQL."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

import psycopg

UPSERT = """
INSERT INTO pet_medical_knowledge (
    knowledge_id, title, content, species, domain, knowledge_type,
    keywords, retrieval_intent, risk_level, source_ids, source_urls,
    evidence_type, review_status, commercial_use_status,
    clinical_use_boundary, dataset_version
) VALUES (
    %(knowledge_id)s, %(title)s, %(content)s, %(species)s, %(domain)s,
    %(knowledge_type)s, %(keywords)s, %(retrieval_intent)s, %(risk_level)s,
    %(source_ids)s, %(source_urls)s, %(evidence_type)s, %(review_status)s,
    %(commercial_use_status)s, %(clinical_use_boundary)s, %(dataset_version)s
)
ON CONFLICT (knowledge_id) DO UPDATE SET
    title = EXCLUDED.title, content = EXCLUDED.content, species = EXCLUDED.species,
    domain = EXCLUDED.domain, knowledge_type = EXCLUDED.knowledge_type,
    keywords = EXCLUDED.keywords, retrieval_intent = EXCLUDED.retrieval_intent,
    risk_level = EXCLUDED.risk_level, source_ids = EXCLUDED.source_ids,
    source_urls = EXCLUDED.source_urls, evidence_type = EXCLUDED.evidence_type,
    review_status = EXCLUDED.review_status,
    commercial_use_status = EXCLUDED.commercial_use_status,
    clinical_use_boundary = EXCLUDED.clinical_use_boundary,
    dataset_version = EXCLUDED.dataset_version
"""

def text_list(value: Any) -> list[str]:
    return [str(item) for item in (value or [])]

def load_records(path: Path) -> tuple[str, list[dict[str, Any]]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    records = payload.get("knowledge_points")
    if not isinstance(records, list) or not records:
        raise ValueError("knowledge_points must be a non-empty array")
    return str(payload.get("schema_version", "unknown")), records

def normalize(record: dict[str, Any], version: str) -> dict[str, Any]:
    required = ("knowledge_id", "title", "content", "domain", "risk_level")
    missing = [key for key in required if not record.get(key)]
    if missing:
        raise ValueError(f"{record.get('knowledge_id', '<unknown>')} missing: {', '.join(missing)}")
    return {
        "knowledge_id": record["knowledge_id"], "title": record["title"],
        "content": record["content"], "species": text_list(record.get("species")),
        "domain": record["domain"], "knowledge_type": record.get("knowledge_type", "未分类"),
        "keywords": text_list(record.get("keywords")), "retrieval_intent": text_list(record.get("retrieval_intent")),
        "risk_level": record["risk_level"], "source_ids": text_list(record.get("source_ids")),
        "source_urls": text_list(record.get("source_urls")), "evidence_type": record.get("evidence_type"),
        "review_status": record.get("review_status", "pending_vet_review"),
        "commercial_use_status": record.get("commercial_use_status", "not_cleared"),
        "clinical_use_boundary": record.get("clinical_use_boundary"), "dataset_version": version,
    }

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", default="data/pet-medical-knowledge-base-v2.json")
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL"))
    args = parser.parse_args()
    if not args.database_url:
        raise SystemExit("Set DATABASE_URL, e.g. postgresql://lab_user:password@localhost:5432/ai_lab")
    version, records = load_records(Path(args.file))
    rows = [normalize(record, version) for record in records]
    with psycopg.connect(args.database_url) as connection:
        with connection.cursor() as cursor:
            cursor.executemany(UPSERT, rows)
        connection.commit()
    print(f"Imported {len(rows)} records (dataset version {version}).")

if __name__ == "__main__":
    main()
