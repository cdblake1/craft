<#
.SYNOPSIS
    Reality gate for the craft compose MCP: drive the real server.js over stdio.

.DESCRIPTION
    Unit tests exercise handleRequest in-memory. This drives `node server.js` as a
    spawned process with newline-delimited JSON-RPC on stdin (against a temp
    CRAFT_DATA_ROOT) and asserts the roadmap->plan->item hierarchy round-trips
    through the storage adapter: initialize + tools/list (9) + a create chain +
    a tree read.
#>
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$server = Join-Path $repoRoot 'plugins\craft\mcp-servers\compose\server.js'
$pass = 0; $fail = 0
function Check($cond, $msg) { if ($cond) { "  PASS: $msg" } else { "  FAIL: $msg"; $script:fail++ }; if ($cond) { $script:pass++ } }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host "FAIL: node not on PATH"; exit 1 }

$root = Join-Path ([IO.Path]::GetTempPath()) "craft-compose-stdio-$([Guid]::NewGuid().ToString('N').Substring(0,8))"
New-Item -ItemType Directory -Path $root -Force | Out-Null

try {
    $env:CRAFT_DATA_ROOT = $root
    # Build the graph step by step: the plan needs the roadmap id, the item the
    # plan id, so issue them in sequence and thread the ids through.
    $rmId = (('{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"compose_roadmap","arguments":{"title":"H2"}}}') `
        | & node $server 2>$null | ConvertFrom-Json).result.structuredContent.id
    Check ($rmId -and $rmId.Length -eq 26) "compose_roadmap returns a ULID over stdio"

    $planReq = '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"compose_plan","arguments":{"title":"Ship it","parent_id":"' + $rmId + '"}}}'
    $planId = ($planReq | & node $server 2>$null | ConvertFrom-Json).result.structuredContent.id
    Check ($planId -and $planId.Length -eq 26) "compose_plan returns a ULID over stdio"

    $capReq = '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"compose_capture","arguments":{"title":"do the work","plan_id":"' + $planId + '"}}}'
    $itemId = ($capReq | & node $server 2>$null | ConvertFrom-Json).result.structuredContent.id
    Check ($itemId -and $itemId.Length -eq 26) "compose_capture returns a ULID over stdio"

    # Now read the whole graph back in one process with initialize + list + tree.
    $reqs = @(
        '{"jsonrpc":"2.0","id":1,"method":"initialize"}',
        '{"jsonrpc":"2.0","id":2,"method":"tools/list"}',
        '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"compose_tree","arguments":{}}}'
    ) -join "`n"
    $byId = @{}
    foreach ($l in ($reqs | & node $server 2>$null)) { if ($l.Trim()) { $o = $l | ConvertFrom-Json; $byId[[int]$o.id] = $o } }

    Check ($byId[1].result.serverInfo.name -eq 'craft-compose') "initialize returns craft-compose"
    Check ($byId[2].result.tools.Count -eq 9) "tools/list returns 9 tools"
    $tree = $byId[3].result.structuredContent
    Check ($tree.roadmaps.Count -eq 1) "tree has the roadmap"
    Check ($tree.roadmaps[0].plans[0].id -eq $planId) "tree threads roadmap->plan"
    Check ($tree.roadmaps[0].plans[0].items[0].id -eq $itemId) "tree threads plan->item through the adapter"
} finally {
    Remove-Item Env:\CRAFT_DATA_ROOT -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force $root -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Total: $pass passed, $fail failed"
exit ($(if ($fail -eq 0) { 0 } else { 1 }))
