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
Check ($pj.agents -eq 'agents/') "plugin.json agents path"

$cp = Get-Content "$root\plugins\craft\.claude-plugin\plugin.json" -Raw | ConvertFrom-Json
Check ($cp.name -eq 'craft') ".claude-plugin/plugin.json name is craft"
# Claude Code auto-discovers skills/agents/mcpServers/hooks from the plugin root,
# so the Claude manifest intentionally carries no path fields.
Check ($null -eq $cp.skills -and $null -eq $cp.agents -and $null -eq $cp.hooks) ".claude-plugin/plugin.json omits path fields (Claude auto-discovery)"

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

foreach ($sk in 'clarify-intent', 'writing-documentation') {
  $p = "$root\plugins\craft\skills\$sk\SKILL.md"
  Check (Test-Path $p) "$sk SKILL.md exists"
  if (Test-Path $p) {
    $t = Get-Content $p -Raw
    Check ($t -match "(?m)^name:\s*$sk") "$sk SKILL.md has name front-matter"
    Check ($t -match '(?m)^description:\s*\S') "$sk SKILL.md has description front-matter"
  }
}

$agentsDir = "$root\plugins\craft\agents"
Check (Test-Path $agentsDir) "agents directory exists"
foreach ($ag in 'Local-Code-Review', 'Local-Code-Review-Consistency') {
  $ap = "$agentsDir\$ag.agent.md"
  Check (Test-Path $ap) "$ag.agent.md exists"
  if (Test-Path $ap) {
    $at = Get-Content $ap -Raw
    Check ($at -match '(?m)^name:\s*\S') "$ag.agent.md has name front-matter"
    Check ($at -match '(?m)^description:\s*\S') "$ag.agent.md has description front-matter"
  }
}

$hooksCopilot = "$root\plugins\craft\hooks\hooks.copilot.json"
Check (Test-Path $hooksCopilot) "hooks.copilot.json exists"
if (Test-Path $hooksCopilot) {
  $hj = Get-Content $hooksCopilot -Raw | ConvertFrom-Json
  foreach ($ev in 'sessionStart', 'postToolUse', 'postToolUseFailure', 'sessionEnd') {
    $cmd = $hj.hooks.$ev[0].powershell
    Check ($cmd -match "dispatch\.js`"? $ev") "hooks.copilot.json wires $ev to the dispatcher"
  }
}
Check (Test-Path "$root\plugins\craft\hooks\hooks.json") "hooks.json (Claude format) exists"

Check ($pj.mcpServers -eq '.mcp.json') "plugin.json points at .mcp.json"
Check ($pj.hooks -eq 'hooks/hooks.copilot.json') "plugin.json points at hooks.copilot.json"

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