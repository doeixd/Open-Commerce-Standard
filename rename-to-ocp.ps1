# ============================================================================
# Rename Project: Open Commerce Standard (OCS) → Open Commerce Protocol (OCP)
# ============================================================================
# This script performs a comprehensive rename across the entire codebase
# Run from project root: .\rename-to-ocp.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "OCS → OCP Rename Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Confirm before proceeding
$confirm = Read-Host "This will rename the entire project from OCS to OCP. Continue? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Aborted." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Phase 1: Content Replacement" -ForegroundColor Green
Write-Host "----------------------------" -ForegroundColor Green

# Define file patterns to process
$filePatterns = @(
    "*.md",
    "*.html",
    "*.yaml",
    "*.json",
    "*.js",
    "*.ts",
    "*.svg"
)

# Get all files to process (excluding node_modules, .git, dist)
$filesToProcess = Get-ChildItem -Recurse -File -Include $filePatterns |
    Where-Object { $_.FullName -notmatch '\\node_modules\\|\\\.git\\|\\dist\\' }

Write-Host "Found $($filesToProcess.Count) files to process" -ForegroundColor Yellow

# Define replacement patterns (order matters!)
$replacements = @(
    # Full names
    @{ Pattern = 'Open Commerce Standard'; Replacement = 'Open Commerce Protocol' },

    # Acronyms in text and titles
    @{ Pattern = '\bOCS\b'; Replacement = 'OCP'; IsRegex = $true },

    # Capability IDs (must come before general dev.ocs)
    @{ Pattern = 'dev\.ocs\.'; Replacement = 'dev.ocp.'; IsRegex = $true },

    # Media types
    @{ Pattern = 'application/ocs\+json'; Replacement = 'application/ocp+json'; IsRegex = $true },

    # Schema URLs
    @{ Pattern = 'schemas\.ocs\.dev'; Replacement = 'schemas.ocp.dev'; IsRegex = $true },

    # Well-known paths
    @{ Pattern = '\.well-known/ocs'; Replacement = '.well-known/ocp' },
    @{ Pattern = '/\.well-known/ocs'; Replacement = '/.well-known/ocp' },

    # HTTP Headers
    @{ Pattern = 'OCS-Discovery'; Replacement = 'OCP-Discovery' },
    @{ Pattern = 'Accept-OCS-Capabilities'; Replacement = 'Accept-OCP-Capabilities' },
    @{ Pattern = 'X-OCS-'; Replacement = 'X-OCP-' },

    # JSON object keys (in examples and schemas)
    @{ Pattern = '"ocs"\s*:'; Replacement = '"ocp":'; IsRegex = $true },
    @{ Pattern = '''ocs'''; Replacement = '''ocp''' },

    # URLs and paths containing /ocs/
    @{ Pattern = '/ocs/'; Replacement = '/ocp/' },

    # Context files
    @{ Pattern = 'context\.ocs\.'; Replacement = 'context.ocp.'; IsRegex = $true },

    # Package/project names
    @{ Pattern = 'Open-Commerce-Standard'; Replacement = 'Open-Commerce-Protocol' },

    # Lowercase in code/identifiers
    @{ Pattern = '\bocs([A-Z])'; Replacement = 'ocp$1'; IsRegex = $true },  # ocsProperty -> ocpProperty

    # File/directory references
    @{ Pattern = 'ocs-discovery'; Replacement = 'ocp-discovery' }
)

$changedFiles = 0
$totalReplacements = 0

foreach ($file in $filesToProcess) {
    $content = Get-Content -Path $file.FullName -Raw -ErrorAction SilentlyContinue

    if ($null -eq $content) {
        continue
    }

    $originalContent = $content
    $fileReplacements = 0

    foreach ($replacement in $replacements) {
        if ($replacement.IsRegex) {
            $newContent = $content -replace $replacement.Pattern, $replacement.Replacement
        } else {
            $newContent = $content -replace [regex]::Escape($replacement.Pattern), $replacement.Replacement
        }

        if ($newContent -ne $content) {
            $fileReplacements += ($content.Length - $newContent.Length)
            $content = $newContent
        }
    }

    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $changedFiles++
        $relativePath = $file.FullName.Replace((Get-Location).Path + "\", "")
        Write-Host "  ✓ $relativePath" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "✓ Modified $changedFiles files" -ForegroundColor Green

Write-Host ""
Write-Host "Phase 2: File and Directory Renaming" -ForegroundColor Green
Write-Host "-------------------------------------" -ForegroundColor Green

# Rename specific files
$filesToRename = @(
    @{ Old = 'docs\ocs-discovery.md'; New = 'docs\ocp-discovery.md' },
    @{ Old = 'examples\.well-known\ocs'; New = 'examples\.well-known\ocp' }
)

foreach ($fileRename in $filesToRename) {
    $oldPath = Join-Path (Get-Location) $fileRename.Old
    $newPath = Join-Path (Get-Location) $fileRename.New

    if (Test-Path $oldPath) {
        Move-Item -Path $oldPath -Destination $newPath -Force
        Write-Host "  ✓ Renamed: $($fileRename.Old) → $($fileRename.New)" -ForegroundColor Gray
    } else {
        Write-Host "  ⚠ File not found: $($fileRename.Old)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Phase 3: Verification" -ForegroundColor Green
Write-Host "--------------------" -ForegroundColor Green

# Search for any remaining OCS references (excluding certain patterns)
Write-Host "Searching for remaining 'OCS' references..." -ForegroundColor Yellow

$remainingOCS = Get-ChildItem -Recurse -File -Include $filePatterns |
    Where-Object { $_.FullName -notmatch '\\node_modules\\|\\\.git\\|\\dist\\' } |
    Select-String -Pattern '\bOCS\b|dev\.ocs\.|\.ocs\.|/ocs/' -CaseSensitive |
    Where-Object { $_.Line -notmatch 'DOCS|OCS-like|legacy OCS|former OCS' }

if ($remainingOCS) {
    Write-Host ""
    Write-Host "⚠ Found potential remaining OCS references:" -ForegroundColor Yellow
    $remainingOCS | ForEach-Object {
        $relativePath = $_.Path.Replace((Get-Location).Path + "\", "")
        Write-Host "  $relativePath`:$($_.LineNumber) - $($_.Line.Trim())" -ForegroundColor Gray
    }
} else {
    Write-Host "✓ No remaining OCS references found" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Rename Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor White
Write-Host "  • Modified $changedFiles files" -ForegroundColor White
Write-Host "  • Renamed files and directories" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Review changes: git diff" -ForegroundColor White
Write-Host "  2. Update repository URL if needed" -ForegroundColor White
Write-Host "  3. Update any external documentation" -ForegroundColor White
Write-Host "  4. Test the application" -ForegroundColor White
Write-Host "  5. Commit: git add . && git commit -m 'Rename from OCS to OCP'" -ForegroundColor White
Write-Host ""
