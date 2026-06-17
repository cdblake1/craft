# Lightweight production checks for the craft plugin.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$fail = 0
function Check($cond, $msg) { if ($cond) { "PASS: $msg" } else { "FAIL: $msg"; $script:fail++ } }

$mk = Get-Content "$root\.claude-plugin\marketplace.json" -Raw | ConvertFrom-Json
Check ($mk.name -eq 'craft') "marketplace name is craft"
Check ($mk.plugins[0].name -eq 'craft') "marketplace lists plugin craft"
Check ($mk.plugins[0].source -eq './plugins/craft') "marketplace source path correct"

$pj = Get-Content "$root\plugins\craft\plugin.json" -Raw | ConvertFrom-Json
Check ($pj.name -eq 'craft') "plugin.json name is craft"
Check ($pj.skills -eq 'skills/') "plugin.json skills path"

$cp = Get-Content "$root\plugins\craft\.claude-plugin\plugin.json" -Raw | ConvertFrom-Json
Check ($cp.name -eq 'craft') ".claude-plugin/plugin.json name is craft"
Check ($cp.skills -eq '../skills/') ".claude-plugin/plugin.json skills path"

$skill = "$root\plugins\craft\skills\implementation\SKILL.md"
Check (Test-Path $skill) "implementation SKILL.md exists"
if (Test-Path $skill) {
  $txt = Get-Content $skill -Raw
  Check ($txt -match '(?m)^name:\s*implementation') "SKILL.md has name front-matter"
  Check ($txt -match '(?m)^description:\s*\S') "SKILL.md has description front-matter"
}

$decompose = "$root\plugins\craft\skills\decompose\SKILL.md"
Check (Test-Path $decompose) "decompose SKILL.md exists"
if (Test-Path $decompose) {
  $dtxt = Get-Content $decompose -Raw
  Check ($dtxt -match '(?m)^name:\s*decompose') "decompose SKILL.md has name front-matter"
  Check ($dtxt -match '(?m)^description:\s*\S') "decompose SKILL.md has description front-matter"
}

foreach ($wf in 'research', 'experiment') {
  $p = "$root\plugins\craft\skills\$wf\SKILL.md"
  Check (Test-Path $p) "$wf SKILL.md exists"
  if (Test-Path $p) {
    $t = Get-Content $p -Raw
    Check ($t -match "(?m)^name:\s*$wf") "$wf SKILL.md has name front-matter"
    Check ($t -match '(?m)^description:\s*\S') "$wf SKILL.md has description front-matter"
  }
}

$hooksJson = "$root\plugins\craft\hooks\hooks.json"
Check (Test-Path $hooksJson) "hooks.json exists"
if (Test-Path $hooksJson) {
  $hj = Get-Content $hooksJson -Raw | ConvertFrom-Json
  foreach ($ev in 'sessionStart', 'postToolUse', 'postToolUseFailure', 'sessionEnd') {
    $cmd = $hj.hooks.$ev[0].powershell
    Check ($cmd -match "dispatch\.js`"? $ev") "hooks.json wires $ev to the dispatcher"
  }
}

Check ($pj.mcpServers -eq '.mcp.json') "plugin.json points at .mcp.json"
Check ($pj.hooks -eq 'hooks/hooks.json') "plugin.json points at hooks.json"
Check ($cp.mcpServers -eq '../.mcp.json') ".claude-plugin/plugin.json points at .mcp.json"
Check ($cp.hooks -eq '../hooks/hooks.json') ".claude-plugin/plugin.json points at hooks.json"

$mcpJson = "$root\plugins\craft\.mcp.json"
Check (Test-Path $mcpJson) ".mcp.json exists"
if (Test-Path $mcpJson) {
  $mj = Get-Content $mcpJson -Raw | ConvertFrom-Json
  foreach ($srv in 'craft-journal', 'craft-compose') {
    $entry = $mj.mcpServers.$srv
    Check ($null -ne $entry) ".mcp.json registers $srv"
    if ($entry) {
      $rel = ($entry.args[0] -replace '\$\{CLAUDE_PLUGIN_ROOT\}', "$root\plugins\craft") -replace '/', '\'
      Check (Test-Path $rel) "$srv server file exists ($([IO.Path]::GetFileName($rel)))"
    }
  }
}

# Node tests (zero-dep; Node 18+ required). Auto-discovers every *.test.js.
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
  $testFiles = Get-ChildItem -Path "$root\plugins\craft" -Recurse -Filter '*.test.js' -File | Sort-Object FullName
  foreach ($tf in $testFiles) {
    & $node.Source $tf.FullName | Out-Null
    Check ($LASTEXITCODE -eq 0) "node test: $($tf.Name)"
  }
} else {
  Check $false "node is on PATH (required for lib tests)"
}

# Reality gate: drive the real journal MCP over stdio (a unit test on handleRequest
# is not proof the spawned process works).
$stdioTest = Join-Path $PSScriptRoot 'Test-CraftJournalMcpStdio.ps1'
if (Test-Path $stdioTest) {
  & $stdioTest | Out-Null
  Check ($LASTEXITCODE -eq 0) "journal MCP stdio reality gate"
}

$composeStdio = Join-Path $PSScriptRoot 'Test-CraftComposeMcpStdio.ps1'
if (Test-Path $composeStdio) {
  & $composeStdio | Out-Null
  Check ($LASTEXITCODE -eq 0) "compose MCP stdio reality gate"
}

if ($fail -gt 0) { Write-Error "$fail check(s) failed"; exit 1 } else { "All checks passed."; exit 0 }