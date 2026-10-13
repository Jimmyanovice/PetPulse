"""Generate embeddings through a configurable OpenAI-compatible HTTP API."""
from __future__ import annotations

import argparse
import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import quote

import psycopg
from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parent.parent / ".env")


DEFAULT_ENDPOINT = "https://quanzil.com/v1/embeddings"
DEFAULT_MODEL = "gemini-embedding-2-preview:stable"
DIMENSION = 3072

SELECT_SQL = """
SELECT id, knowledge_id, title, content, keywords, retrieval_intent, clinical_use_boundary
FROM pet_medical_knowledge
WHERE review_status = %s
  AND (embedding IS NULL OR %s)
ORDER BY id
"""

UPDATE_SQL = """
UPDATE pet_medical_knowledge
SET embedding = %s::halfvec
WHERE id = %s AND knowledge_id = %s
"""


def database_url_from_env() -> str | None:
    if url := os.getenv("DATABASE_URL"):
        return url
    password = os.getenv("POSTGRES_PASSWORD")
    if not password:
        return None
    return (
        "postgresql://"
        f"{quote(os.getenv('POSTGRES_USER', 'lab_user'), safe='')}"
        f":{quote(password, safe='')}"
        f"@localhost:{os.getenv('POSTGRES_PORT', '5432')}"
        f"/{quote(os.getenv('POSTGRES_DB', 'ai_lab'), safe='')}"
    )


def embedding_text(row: tuple[object, ...]) -> str:
    _, _, title, content, keywords, intents, boundary = row
    return (
        f"标题：{title}\n内容：{content}\n"
        f"关键词：{'、'.join(keywords or [])}\n"
        f"常见提问：{'；'.join(intents or [])}\n"
        f"使用边界：{boundary or ''}"
    )


def vector_literal(values: list[float]) -> str:
    return "[" + ",".join(format(float(value), ".9g") for value in values) + "]"


def request_embeddings(
    endpoint: str,
    api_key: str,
    model: str,
    route: str | None,
    texts: list[str],
) -> list[list[float]]:
    request_body: dict[str, object] = {"model": model, "input": texts}
    if route:
        request_body["provider"] = {"sort": route}
    payload = json.dumps(request_body).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=payload,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Embedding API returned HTTP {error.code}: {detail[:500]}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"Could not reach embedding API: {error.reason}") from error

    data = body.get("data") if isinstance(body, dict) else None
    if not isinstance(data, list):
        raise RuntimeError("Embedding API response must contain a 'data' array")
    ordered = sorted(data, key=lambda item: item.get("index", 0))
    embeddings = [item.get("embedding") for item in ordered]
    if not all(isinstance(values, list) for values in embeddings):
        raise RuntimeError("Each API data item must contain an embedding array")
    if len(embeddings) != len(texts):
        raise RuntimeError(f"API returned {len(embeddings)} embeddings for {len(texts)} inputs")
    return embeddings


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database-url", default=database_url_from_env())
    parser.add_argument("--api-key", default=os.getenv("EMBEDDING_API_KEY"))
    parser.add_argument("--endpoint", default=os.getenv("EMBEDDING_API_URL", DEFAULT_ENDPOINT))
    parser.add_argument("--model", default=os.getenv("EMBEDDING_MODEL", DEFAULT_MODEL))
    parser.add_argument("--route", choices=("price", "speed", "success_rate"), default=os.getenv("EMBEDDING_ROUTE"))
    parser.add_argument("--dimension", type=int, default=int(os.getenv("EMBEDDING_DIMENSION", DIMENSION)))
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--status", default="approved")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    if not args.database_url:
        raise SystemExit("Set DATABASE_URL before running this script")
    if not args.api_key:
        raise SystemExit("Set EMBEDDING_API_KEY before running this script")
    if args.dimension != DIMENSION:
        raise SystemExit(f"Current database schema requires dimension {DIMENSION}")
    if args.batch_size < 1:
        raise SystemExit("--batch-size must be positive")

    with psycopg.connect(args.database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(SELECT_SQL, (args.status, args.force))
            rows = cursor.fetchall()
            if not rows:
                print(f"No records found with review_status={args.status!r} requiring embeddings.")
                return
            for start in range(0, len(rows), args.batch_size):
                batch = rows[start : start + args.batch_size]
                vectors = request_embeddings(
                    args.endpoint,
                    args.api_key,
                    args.model,
                    args.route,
                    [embedding_text(row) for row in batch],
                )
                for row, values in zip(batch, vectors, strict=True):
                    if len(values) != args.dimension:
                        raise RuntimeError(f"API returned {len(values)} dimensions; expected {args.dimension}")
                    cursor.execute(UPDATE_SQL, (vector_literal(values), row[0], row[1]))
                connection.commit()
                print(f"Embedded {min(start + len(batch), len(rows))}/{len(rows)} records.")


if __name__ == "__main__":
    main()
