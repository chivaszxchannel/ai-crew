# review.ps1 — run an independent CLI reviewer (read-only) over .crew/review-request.md and record the verdict.
# Usage:
#   powershell -ExecutionPolicy Bypass -File review.ps1 -Round 1 -Reviewers codex,gemini [-Model <name>] [-TimeoutSec 900] [-StateDir .crew]
# -Reviewers takes ONE comma-separated string ("codex,gemini"), never a PowerShell array. Always invoke with -File, not -Command.
# Antigravity (agy) is NOT a reviewer here — it is the optional image provider (tools/gen-image.mjs).
# Tries each CLI reviewer in order. Exit codes:
#   0 = VERDICT: PASS          1 = VERDICT: FAIL (or no verdict line)
#   2 = (single reviewer) unavailable   3 = no CLI reviewer in the chain was available -> use the reviewer-fallback agent
# The first line of output always says which reviewer produced the verdict, or why none could:
#   REVIEWER_USED: codex | REVIEWER_NOT_FOUND | REVIEWER_NOT_LOGGED_IN | REVIEWER_RATE_LIMITED | REVIEWER_ERROR | NO_CLI_REVIEWER
param(
    # ONE comma-separated string, not [string[]] — see note below. CLI reviewers only: codex, gemini
    [string]$Reviewers = "codex,gemini",
    [int]$Round = 1,
    [string]$Model = "",
    [int]$TimeoutSec = 900,
    [string]$StateDir = ".crew"
)
# Why a string and not [string[]]: with `powershell -File script.ps1 -Reviewers codex,gemini`
# every argument arrives as a literal string, so a [string[]] parameter binds ONE element
# "codex,gemini" (comma-splitting is a PowerShell *expression* feature, not string coercion).
# That element matches no known reviewer, so every reviewer was skipped silently while the
# failure line still read "none of [codex, gemini]" — a -join on a 1-element array reproduces
# the original text. `-Command` binds the array correctly but loses the script's exit code
# (3 became 1), which breaks the skill's branching. Splitting here makes -File correct on both.
$ErrorActionPreference = "Continue"
$ReviewerList = @($Reviewers -split ',' | ForEach-Object { $_.Trim().ToLower() } | Where-Object { $_ })
$crewDir = Join-Path (Get-Location) $StateDir
$request = Join-Path $crewDir "review-request.md"
if (-not (Test-Path $crewDir)) { New-Item -ItemType Directory -Force $crewDir | Out-Null }
if (-not (Test-Path $request)) { Write-Output "REVIEWER_ERROR: $request not found"; exit 1 }

$prompt = "Read the file $StateDir/review-request.md in the current directory and perform the review exactly as it instructs. Do not modify any file. Your reply MUST start with the line VERDICT: PASS or VERDICT: FAIL."

function Q([string]$s) { return '"' + ($s -replace '"', '\"') + '"' }   # PS 5.1 does not quote ArgumentList items

function Find-Cli([string[]]$names) {
    foreach ($n in $names) {
        $c = Get-Command $n -ErrorAction SilentlyContinue | Where-Object { $_.Source -notmatch '\.ps1$' } | Select-Object -First 1
        if ($c) { return $c.Source }
    }
    return $null
}

function Run-Reviewer([string]$name) {
    $output = Join-Path $crewDir ("review-{0}-{1}.md" -f $Round, $name)
    $log    = Join-Path $crewDir ("review-{0}-{1}.log" -f $Round, $name)
    $err    = $log + ".err"
    Remove-Item $output, $log, $err -ErrorAction SilentlyContinue

    switch ($name) {
        "codex" {
            $exe = Find-Cli @("codex.cmd", "codex.exe", "codex")
            if (-not $exe) { return @{ code = 2; reason = "REVIEWER_NOT_FOUND: codex (npm install -g @openai/codex; codex login)" } }
            $a = "exec --sandbox read-only --skip-git-repo-check --output-last-message " + (Q $output)
            if ($Model) { $a += " --model " + (Q $Model) }
            $a += " " + (Q $prompt)
        }
        "gemini" {
            $exe = Find-Cli @("gemini.cmd", "gemini.exe", "gemini")
            if (-not $exe) { return @{ code = 2; reason = "REVIEWER_NOT_FOUND: gemini (npm install -g @google/gemini-cli; run gemini once to sign in)" } }
            $a = "-p " + (Q $prompt)
            if ($Model) { $a += " -m " + (Q $Model) }
        }
        default { return @{ code = 2; reason = "REVIEWER_NOT_FOUND: unknown CLI reviewer '$name'" } }
    }

    $emptyIn = Join-Path $crewDir ".empty-stdin"
    if (-not (Test-Path $emptyIn)) { New-Item -ItemType File -Force $emptyIn | Out-Null }
    $proc = Start-Process -FilePath $exe -ArgumentList $a -NoNewWindow -PassThru -RedirectStandardInput $emptyIn -RedirectStandardOutput $log -RedirectStandardError $err
    if (-not $proc.WaitForExit($TimeoutSec * 1000)) { try { $proc.Kill() } catch {}; return @{ code = 2; reason = "REVIEWER_ERROR: $name timed out after $TimeoutSec s (see $log)" } }

    $errText = ""; if (Test-Path $err) { $errText = Get-Content $err -Raw -ErrorAction SilentlyContinue }
    $logText = ""; if (Test-Path $log) { $logText = Get-Content $log -Raw -ErrorAction SilentlyContinue }
    $all = $errText + "`n" + $logText
    if ($all -match "(?i)not logged in|login required|unauthorized|401|please sign in|authentication") { return @{ code = 2; reason = "REVIEWER_NOT_LOGGED_IN: $name" } }
    if ($all -match "(?i)rate limit|usage limit|limit reached|quota|too many requests|429|insufficient_quota|plan limit|resource_exhausted") { return @{ code = 2; reason = "REVIEWER_RATE_LIMITED: $name" } }

    # gemini prints to stdout; codex writes the file. Normalise: make sure $output exists.
    if ($name -ne "codex" -and -not (Test-Path $output) -and $logText) { Set-Content -Path $output -Value $logText -Encoding UTF8 }
    if (-not (Test-Path $output)) { return @{ code = 2; reason = "REVIEWER_ERROR: $name produced no output (exit $($proc.ExitCode), see $log / $err)" } }

    $content = Get-Content $output -Raw
    if ($content -match "(?m)^\s*VERDICT:\s*PASS") { return @{ code = 0; reason = "REVIEWER_USED: $name"; file = $output; text = $content } }
    return @{ code = 1; reason = "REVIEWER_USED: $name"; file = $output; text = $content }
}

$tried = @()
foreach ($r in $ReviewerList) {
    if ($r -notin @("codex", "gemini")) { continue }   # agent-based reviewers are handled by the skill, not here
    $res = Run-Reviewer $r
    $tried += ("{0}: {1}" -f $r, $res.reason)
    if ($res.code -le 1) {
        Write-Output $res.reason
        Write-Output ("REVIEW_FILE: " + $res.file)
        Write-Output "----- review (round $Round, $r) -----"
        Write-Output $res.text
        Write-Output "----- end -----"
        exit $res.code
    }
}
if ($tried.Count -eq 0) {
    # Nothing in the list was a CLI reviewer this script knows. Say so plainly instead of
    # letting it look like the reviewers were tried and were unavailable.
    Write-Output "NO_CLI_REVIEWER: no known CLI reviewer in [$($ReviewerList -join ', ')] (known: codex, gemini) -> use the reviewer-fallback agent"
} else {
    Write-Output "NO_CLI_REVIEWER: none of [$($ReviewerList -join ', ')] could run this round -> use the reviewer-fallback agent"
}
$tried | ForEach-Object { Write-Output ("  " + $_) }
exit 3
