<#
.SYNOPSIS
    Reality gate for the craft journal MCP: drive the real server.js over stdio.

.DESCRIPTION
    A unit test against handleRequest in-memory does not prove the MCP works as a
    spawned process. This drives `node server.js` with newline-delimited JSON-RPC
    on stdin (against a temp CRAFT_DATA_ROOT) and asserts initialize + tools/list
    + a tools/call round-trip through the storage adapter.
#>
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$server = Join-Path $repoRoot 'plugins\craft\mcp-servers\journal\server.js'
$pass = 0; $fail = 0
function Check($cond, $msg) { if ($cond) { "  PASS: $msg" } else { "  FAIL: $msg"; $script:fail++ }; if ($cond) { $script:pass++ } }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host "FAIL: node not on PATH"; exit 1 }

$root = Join-Path ([IO.Path]::GetTempPath()) "craft-stdio-$([Guid]::NewGuid().ToString('N').Substring(0,8))"
$leaf = Join-Path $root 'journals\repo\dev\test\live'
New-Item -ItemType Directory -Path (Join-Path $leaf 'findings') -Force | Out-Null
'{"repo":"repo","branch":"dev/test/live"}' | Set-Content (Join-Path $leaf 'meta.json')
"# Finding: atomic kernel-level exclusion`n`n## When to read this`n`nClaim layer.`n`nUse O_EXCL." | Set-Content (Join-Path $leaf 'findings\01-atomic.md')

try {
    $env:CRAFT_DATA_ROOT = $root
    $reqs = @(
        '{"jsonrpc":"2.0","id":1,"method":"initialize"}',
        '{"jsonrpc":"2.0","id":2,"method":"tools/list"}',
        '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"journal_find_findings","arguments":{"query":"atomic claim exclusion"}}}'
    ) -join "`n"
    $lines = $reqs | & node $server 2>$null
    $byId = @{}
    foreach ($l in $lines) { if ($l.Trim()) { $o = $l | ConvertFrom-Json; $byId[[int]$o.id] = $o } }

    Check ($byId[1].result.serverInfo.name -eq 'craft-journal') "initialize returns craft-journal"
    Check ($byId[2].result.tools.Count -eq 9) "tools/list returns 9 tools"
    Check ($byId[3].result.structuredContent.count -ge 1) "find_findings returns a hit over stdio"
    Check ($byId[3].result.structuredContent.findings[0].key -match 'findings/01-atomic\.md$') "result carries a logical adapter key"
} finally {
    Remove-Item Env:\CRAFT_DATA_ROOT -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force $root -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Total: $pass passed, $fail failed"
exit ($(if ($fail -eq 0) { 0 } else { 1 }))
