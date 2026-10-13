$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = Join-Path $projectRoot '.venv\Scripts\python.exe'
$existingListener = Get-NetTCPConnection -State Listen -LocalPort 8001 -ErrorAction SilentlyContinue
if ($existingListener) {
    Write-Host 'Port 8001 is already listening. Open http://127.0.0.1:8001/ai-lab'
    exit 0
}
if (-not (Test-Path -LiteralPath $pythonExe)) { throw 'Project Python environment is missing.' }
$logDirectory = Join-Path $projectRoot 'logs'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$launchStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$process = Start-Process -FilePath $pythonExe -ArgumentList @('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8001') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDirectory "rag-$launchStamp.stdout.log") -RedirectStandardError (Join-Path $logDirectory "rag-$launchStamp.stderr.log")
Write-Host "PetPulse started with PID $($process.Id). Open http://127.0.0.1:8001/ai-lab"
