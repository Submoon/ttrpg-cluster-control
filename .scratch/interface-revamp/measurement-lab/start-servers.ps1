$ErrorActionPreference = 'Stop'
$lab = Split-Path -Parent $MyInvocation.MyCommand.Path
$baselineDir = Join-Path $lab 'source-baseline'
$bDir = Join-Path $lab 'source-b'
$artifacts = Join-Path $lab 'artifacts'

$baselinePort = '3121'
$baselineHost = '127.0.0.1'
$env:PORT = $baselinePort
$env:NITRO_PORT = $baselinePort
$env:HOST = $baselineHost
$env:NITRO_HOST = $baselineHost
$baseline = Start-Process -FilePath 'node' -ArgumentList '.output/server/index.mjs' -WorkingDirectory $baselineDir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $artifacts 'server-baseline.log') -RedirectStandardError (Join-Path $artifacts 'server-baseline-error.log') -PassThru

$bPort = '3122'
$env:PORT = $bPort
$env:NITRO_PORT = $bPort
$env:HOST = $baselineHost
$env:NITRO_HOST = $baselineHost
$b = Start-Process -FilePath 'node' -ArgumentList '.output/server/index.mjs' -WorkingDirectory $bDir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $artifacts 'server-b.log') -RedirectStandardError (Join-Path $artifacts 'server-b-error.log') -PassThru

@{ baseline = $baseline.Id; B = $b.Id } | ConvertTo-Json | Set-Content (Join-Path $artifacts 'server-pids.json')
Write-Output "baselinePid=$($baseline.Id) baselinePort=$baselinePort bPid=$($b.Id) bPort=$bPort"
