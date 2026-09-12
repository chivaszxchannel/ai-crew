# codex-review.ps1 — run Codex CLI as an independent reviewer (read-only) and record the verdict.
# Usage: powershell -ExecutionPolicy Bypass -File codex-review.ps1 -Round 1 [-Model gpt-5-codex] [-TimeoutSec 900]
# Exit codes: 0 = VERDICT PASS, 1 = VERDICT FAIL (or no verdict line), 2 = codex unavailable (not found / not logged in / rate limited) -> use reviewer-fallback
param(
    [int]$Round = 1,
    [string]$Model = "",
    [int]$TimeoutSec = 900
)

$ErrorActionPreference = "Continue"
$crewDir = Join-Path (Get-Location) ".crew"
$request = Join-Path $crewDir "review-request.md"
$output  = Join-Path $crewDir ("codex-review-{0}.md" -f $Round)
$log     = Join-Path $crewDir ("codex-review-{0}.log" -f $Round)

if (-not (Test-Path $crewDir)) { New-Item -ItemType Directory -Force $crewDir | Out-Null }
if (-not (Test-Path $request)) {
    Write-Output "ERROR: $request not found. Create it first (see references/codex-review-prompt.md)."
    exit 1
}

# npm installs three shims (codex, codex.cmd, codex.ps1). Start-Process cannot launch the .ps1 shim,
# so prefer codex.cmd, then codex.exe, then whatever is on PATH.
$codex = Get-Command codex.cmd -ErrorAction SilentlyContinue
if (-not $codex) { $codex = Get-Command codex.exe -ErrorAction SilentlyContinue }
if (-not $codex) { $codex = Get-Command codex -ErrorAction SilentlyContinue | Where-Object { $_.Source -notmatch '\.ps1$' } | Select-Object -First 1 }
if (-not $codex) {
    Write-Output "CODEX_NOT_FOUND: install with 'npm install -g @openai/codex' then run 'codex login'. Falling back to reviewer-fallback agent."
    exit 2
}

$prompt = "Read the file .crew/review-request.md in the current directory and perform the review exactly as it instructs. Your reply MUST start with the line 'VERDICT: PASS' or 'VERDICT: FAIL'."

# Windows PowerShell 5.1 joins an ArgumentList array with spaces and does NOT quote,
# so any argument containing spaces (the prompt, paths) would be split. Build one quoted string instead.
function Q([string]$s) { return '"' + ($s -replace '"', '\"') + '"' }
$argStr = "exec --sandbox read-only --skip-git-repo-check --output-last-message " + (Q $output)
if ($Model -ne "") { $argStr += " --model " + (Q $Model) }
$argStr += " " + (Q $prompt)

Write-Output ("Running: codex " + $argStr)
# 12/09/2026: codex exec รอ "additional input from stdin" จน EOF — ถ้า stdin ที่สืบทอดมาไม่ปิด (เช่นรันจาก tool ของ Claude Code) จะค้างจน timeout → ส่ง stdin ว่างให้เสมอ
$stdinEmpty = Join-Path $env:TEMP "codex-review-stdin-empty.txt"
[IO.File]::WriteAllText($stdinEmpty, "")
$proc = Start-Process -FilePath $codex.Source -ArgumentList $argStr -NoNewWindow -PassThru `
        -RedirectStandardInput $stdinEmpty -RedirectStandardOutput $log -RedirectStandardError ($log + ".err")
if (-not $proc.WaitForExit($TimeoutSec * 1000)) {
    try { $proc.Kill() } catch {}
    Write-Output "ERROR: codex timed out after $TimeoutSec s. See $log"
    exit 1
}

$errText = ""
if (Test-Path ($log + ".err")) { $errText = Get-Content ($log + ".err") -Raw -ErrorAction SilentlyContinue }
$logText = ""
if (Test-Path $log) { $logText = Get-Content $log -Raw -ErrorAction SilentlyContinue }
# 12/09/2026: เช็กโควตาก่อน login — session id ใน banner ของ codex อาจมีเลข 401 ทำให้ติดป้าย NOT_LOGGED_IN ผิดทั้งที่เหตุผลจริงคือ usage limit
if (($errText + $logText) -match "(?i)rate limit|usage limit|limit reached|quota|too many requests|429|insufficient_quota|plan limit") {
    Write-Output "CODEX_RATE_LIMITED: Codex usage limit hit. Falling back to reviewer-fallback agent (Opus) for this round."
    exit 2
}
if ($errText -match "(?i)not logged in|login required|unauthorized") {
    Write-Output "CODEX_NOT_LOGGED_IN: run 'codex login' once. Falling back to reviewer-fallback agent."
    exit 2
}

if (-not (Test-Path $output)) {
    Write-Output "ERROR: codex produced no output file. exit code: $($proc.ExitCode). See $log and $log.err"
    exit 1
}

$content = Get-Content $output -Raw
Write-Output "----- Codex review (round $Round) -----"
Write-Output $content
Write-Output "----- end -----"

if ($content -match "(?m)^\s*VERDICT:\s*PASS") { exit 0 }
exit 1
