#Requires -Version 7.0
<#
.SYNOPSIS
    Mechanical self-review for a long-form technical doc.

.DESCRIPTION
    Runs six checks against a markdown file and reports flags.
    Catches what the script can catch; the human catches the rest.

    Checks:
      1. AI-ism telltales (delve, in summary, ensure that you, furthermore, etc.)
      2. Em-dashes outside block quotes and code fences
      3. First-person plural overuse (we will, let us, as we discussed)
      4. Inflated diction (utilize, facilitate, leverage, commence, terminate, endeavor)
      5. Imprecise quantifiers (many, often, usually, frequently, sometimes, several, various)
      6. Tone disclaimers (may be controversial, please note, note that, some may disagree)

    Em-dashes inside block quotes (` > ` lines) and inside code fences (``` blocks)
    are exempted because cited material legitimately uses them and code is not prose.

.PARAMETER Path
    A single markdown file, or a directory. If a directory, all *.md files under it
    are checked recursively.

.PARAMETER MaxFlagsPerCheck
    Maximum number of offending lines to display per failed check. Default 10.

.PARAMETER Quiet
    Suppress per-file output for files that pass all checks. Failed files still print.

.OUTPUTS
    A summary table. Exit code 0 if all checks pass across all files; 1 if any flag fires.

.EXAMPLE
    .\Invoke-DocSelfReview.ps1 -Path C:\path\to\docs\your-doc.md

.EXAMPLE
    .\Invoke-DocSelfReview.ps1 -Path C:\path\to\docs -Quiet

.NOTES
    Author: Caleb Blake. Part of the writing-documentation skill.
    The script is conservative: false-positive rate is low, but it cannot
    catch semantic issues (heading voice consistency, first-sentence payoff,
    code-sample complexity). Read the doc after the script reports clean.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$Path,

    [int]$MaxFlagsPerCheck = 10,

    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

# Check definitions. Each entry: a label, a regex (PCRE-style), and a default-skip flag
# for em-dashes in block quotes / code fences.
# All checks exempt inline code (backtick-wrapped) and block quotes (lines starting `> `)
# because in teaching docs those forms reference the pattern rather than use it.
$checks = @(
    @{
        Id = 1
        Label = 'AI-ism telltales'
        Pattern = '(?i)\b(delve|in summary|to summarize|in essence|essentially|it is worth noting|it is important to note|ensure that you|make sure to ensure|furthermore|moreover|additionally|nevertheless|crucially)\b'
    }
    @{
        Id = 2
        Label = 'Em-dash outside quote or code'
        Pattern = '—'
    }
    @{
        Id = 3
        Label = 'First-person plural overuse'
        Pattern = '(?i)\b(we will|let us|let''s |as we discussed|we shall|let''s look at|let''s consider)\b'
    }
    @{
        Id = 4
        Label = 'Inflated diction'
        Pattern = '(?i)\b(utilize|utilizes|utilized|utilizing|utilization|facilitate|facilitates|facilitating|leverage|leverages|leveraging|commence|commences|commenced|terminate|terminates|terminated|endeavor|endeavors|endeavoring|aforementioned|prior to|subsequent to|in the event that)\b'
    }
    @{
        Id = 5
        Label = 'Imprecise quantifiers'
        Pattern = '(?i)\b(many users|often improves|usually faster|frequently encountered|sometimes results in|several approaches|various ways|a number of)\b'
    }
    @{
        Id = 6
        Label = 'Tone disclaimers'
        Pattern = '(?i)\b(may be controversial|please note|note that|some may disagree|while this is a matter of debate|it should be noted)\b'
    }
)

function Test-LineInExcludedContext {
    param(
        [string[]]$Lines,
        [int]$LineIndex
    )
    $line = $Lines[$LineIndex]
    # Block quote: line starts with `> ` (optionally indented)
    if ($line -match '^\s*>') {
        return $true
    }
    # Code fence: count fences before this line; odd count means we are inside a fence
    $fenceCount = 0
    for ($i = 0; $i -lt $LineIndex; $i++) {
        if ($Lines[$i] -match '^\s*```') {
            $fenceCount++
        }
    }
    return ($fenceCount % 2) -eq 1
}

function Remove-InlineCode {
    param([string]$Line)
    # Strip text inside backticks so pattern matches against the bare prose.
    # Also strip text inside double quotes because teaching docs cite the
    # pattern as a quoted string (`"Let's delve into..."` or `"utilize"`).
    # We do not handle nested or malformed delimiters; the goal is best-effort
    # prose isolation, not a full parser.
    $stripped = $Line -replace '`[^`]*`', ''
    $stripped = $stripped -replace '"[^"]*"', ''
    return $stripped
}

function Invoke-FileReview {
    param(
        [string]$FilePath,
        [int]$MaxFlags,
        [bool]$Quiet
    )
    if (-not (Test-Path -LiteralPath $FilePath)) {
        Write-Warning "Path not found: $FilePath"
        return 0
    }
    $content = Get-Content -LiteralPath $FilePath -Raw
    $lines = $content -split "`r?`n"
    $totalFlags = 0
    $perCheckResults = @()
    foreach ($check in $checks) {
        $flags = @()
        for ($i = 0; $i -lt $lines.Length; $i++) {
            $rawLine = $lines[$i]
            # Skip block quotes and code fences for all checks. In teaching docs
            # these forms reference the pattern; in user docs cited material is
            # legitimately exempt.
            if (Test-LineInExcludedContext -Lines $lines -LineIndex $i) {
                continue
            }
            # Strip inline code (`text in backticks`) so referenced patterns
            # like `utilize` do not trigger the inflated-diction check.
            $proseLine = Remove-InlineCode -Line $rawLine
            if ($proseLine -match $check.Pattern) {
                $flags += [pscustomobject]@{
                    LineNumber = $i + 1
                    Content    = $rawLine.Trim()
                }
            }
        }
        $perCheckResults += [pscustomobject]@{
            CheckId    = $check.Id
            Label      = $check.Label
            FlagCount  = $flags.Count
            Flags      = $flags
        }
        $totalFlags += $flags.Count
    }
    if ($totalFlags -eq 0) {
        if (-not $Quiet) {
            Write-Host "[PASS] $FilePath" -ForegroundColor Green
        }
        return 0
    }
    Write-Host ""
    Write-Host "[FLAG] $FilePath" -ForegroundColor Yellow
    foreach ($result in $perCheckResults) {
        if ($result.FlagCount -eq 0) { continue }
        Write-Host ("  Check {0}: {1} ({2} flag(s))" -f $result.CheckId, $result.Label, $result.FlagCount) -ForegroundColor Yellow
        $shown = 0
        foreach ($flag in $result.Flags) {
            if ($shown -ge $MaxFlags) {
                Write-Host ("    ... and {0} more" -f ($result.FlagCount - $shown)) -ForegroundColor DarkGray
                break
            }
            $preview = $flag.Content
            if ($preview.Length -gt 120) { $preview = $preview.Substring(0, 117) + '...' }
            Write-Host ("    L{0}: {1}" -f $flag.LineNumber, $preview) -ForegroundColor Gray
            $shown++
        }
    }
    return $totalFlags
}

# Resolve target files
$resolved = Resolve-Path -LiteralPath $Path -ErrorAction Stop
$targetFiles = if (Test-Path -LiteralPath $resolved -PathType Container) {
    Get-ChildItem -LiteralPath $resolved -Recurse -File -Filter '*.md'
} else {
    @(Get-Item -LiteralPath $resolved)
}

if ($targetFiles.Count -eq 0) {
    Write-Warning "No markdown files found at $Path"
    exit 0
}

Write-Host "Reviewing $($targetFiles.Count) file(s)..." -ForegroundColor Cyan

$grandTotal = 0
$failedFiles = 0
foreach ($file in $targetFiles) {
    $fileFlags = Invoke-FileReview -FilePath $file.FullName -MaxFlags $MaxFlagsPerCheck -Quiet $Quiet.IsPresent
    if ($fileFlags -gt 0) {
        $failedFiles++
        $grandTotal += $fileFlags
    }
}

Write-Host ""
Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host ("Files reviewed: {0}" -f $targetFiles.Count)
Write-Host ("Files with flags: {0}" -f $failedFiles)
Write-Host ("Total flags raised: {0}" -f $grandTotal)

if ($grandTotal -gt 0) {
    Write-Host ""
    Write-Host "See references/self-review-checklist.md for fix guidance." -ForegroundColor Cyan
    exit 1
}
exit 0
