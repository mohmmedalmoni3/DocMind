param([string]$Questions = (Join-Path $PSScriptRoot 'questions.json'))
$ErrorActionPreference = 'Stop'
& python (Join-Path $PSScriptRoot 'doctor.py')
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& python (Join-Path $PSScriptRoot 'main.py') $Questions
exit $LASTEXITCODE
