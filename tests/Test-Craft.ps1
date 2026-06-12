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

if ($fail -gt 0) { Write-Error "$fail check(s) failed"; exit 1 } else { "All checks passed."; exit 0 }