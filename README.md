# AI Vector Lab

This is the first local environment for the Docker, PostgreSQL, pgvector, and
embedding learning path. The database runs in Docker and keeps its data in a
named volume.

## 1. Configure the local password

In PowerShell, from this directory:

```powershell
Copy-Item .env.example .env
notepad .env
```

Replace only `POSTGRES_PASSWORD` with a long local development password. Keep
the other values unchanged for this first lesson.

## 2. Start the database

```powershell
docker compose up -d
docker compose ps
```

`ai-vector-postgres` should report `running` and then `healthy`.

## 3. Connect with the PostgreSQL client inside the container

```powershell
docker compose exec db psql -U lab_user -d ai_lab
```

At the `psql` prompt, run:

```sql
\dx
\d documents
SELECT extversion FROM pg_extension WHERE extname = 'vector';
```

Exit with `\q`.

## 4. Run one SQL write and read

```powershell
docker compose exec db psql -U lab_user -d ai_lab -c "INSERT INTO documents (content, metadata) VALUES ('Docker manages repeatable local services.', '{\"topic\": \"docker\"}');"
docker compose exec db psql -U lab_user -d ai_lab -c "SELECT id, content, metadata, created_at FROM documents;"
```

## Important Docker lifecycle commands

```powershell
# Stops and removes the container and network, but retains database data.
docker compose down

# Starts the existing database again.
docker compose up -d

# Deletes the database volume as well. This is destructive.
docker compose down -v
```

## Why `VECTOR(384)`?

The later Python lesson will use the multilingual model
`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`, which emits
384-dimensional embeddings. A pgvector column's dimension must match the
embedding model's output dimension.

## Import the pet-medical knowledge base

Install the local importer:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
```

After the database is running, set a connection URL using the password in
`.env`, then import the JSON file:

```powershell
$env:DATABASE_URL = "postgresql://lab_user:YOUR_PASSWORD@localhost:5432/ai_lab"
py scripts/import_knowledge_base.py
```

The import is idempotent and updates records by `knowledge_id`. Records remain
`pending_vet_review` and have no embedding until they pass medical review.
