param(
  [Parameter(Mandatory=$true)]
  [string]$InputFile
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $InputFile)) {
  throw "Backup file not found: $InputFile"
}

Write-Warning "This restores records into the current database. Existing records with conflicting keys may fail."
Get-Content -LiteralPath $InputFile -Raw | docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f -'
Write-Host "Database restore completed from $InputFile"
