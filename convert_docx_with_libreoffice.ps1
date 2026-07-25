param(
    [Parameter(Mandatory = $true)]
    [string]$InputDocx,

    [string]$OutputDir = (Get-Location).Path
)

$ErrorActionPreference = "Stop"

$soffice = "C:\Program Files\LibreOffice\program\soffice.com"
if (-not (Test-Path -LiteralPath $soffice)) {
    throw "LibreOffice converter not found: $soffice"
}

$resolvedInput = (Resolve-Path -LiteralPath $InputDocx).Path
$resolvedOutput = (New-Item -ItemType Directory -Force -Path $OutputDir).FullName

$workRoot = Join-Path $env:TEMP ("lo_convert_" + [guid]::NewGuid().ToString("N"))
$profileDir = Join-Path $workRoot "profile"
$inDir = Join-Path $workRoot "input"
$outDir = Join-Path $workRoot "output"
New-Item -ItemType Directory -Force -Path $profileDir, $inDir, $outDir | Out-Null

try {
    $tempInput = Join-Path $inDir ([IO.Path]::GetFileName($resolvedInput))
    Copy-Item -LiteralPath $resolvedInput -Destination $tempInput -Force

    $profileUri = ("file:///" + ($profileDir -replace "\\", "/"))
    & $soffice "-env:UserInstallation=$profileUri" --headless --invisible --norestore --nodefault --nolockcheck --nofirststartwizard --convert-to pdf --outdir $outDir $tempInput

    $pdf = Get-ChildItem -LiteralPath $outDir -Filter "*.pdf" | Select-Object -First 1
    if (-not $pdf) {
        throw "LibreOffice did not produce a PDF."
    }

    $dest = Join-Path $resolvedOutput $pdf.Name
    Copy-Item -LiteralPath $pdf.FullName -Destination $dest -Force
    Get-Item -LiteralPath $dest
}
finally {
    Remove-Item -LiteralPath $workRoot -Recurse -Force -ErrorAction SilentlyContinue
}
