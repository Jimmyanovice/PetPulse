param(
  [string]$OutputDirectory = "backups"
)

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$output = Join-Path $OutputDirectory "petpulse-$timestamp.sql"

docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=plain --no-owner --no-privileges' | Out-File -FilePath $output -Encoding utf8
Write-Host "Database backup written to $output"
