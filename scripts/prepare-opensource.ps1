$src = 'C:\Users\sidhe\OneDrive\Desktop\Wander'
$dst = 'C:\Users\sidhe\OneDrive\Desktop\wander-opensource'

if (!(Test-Path $dst)) {
    New-Item -ItemType Directory -Force -Path $dst | Out-Null
}

# 1. Copy source code directories
$folders = @('src', 'electron', 'scripts', 'tests')
foreach ($folder in $folders) {
    $folderSrc = Join-Path $src $folder
    $folderDst = Join-Path $dst $folder
    if (Test-Path $folderSrc) {
        Copy-Item -Path $folderSrc -Destination $dst -Recurse -Force
        Write-Host "Copied folder: $folder"
    }
}

# 2. Copy root configuration files & icons
$files = @(
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'vite.config.ts',
    'electron-builder.json',
    'index.html',
    'app-icon.png',
    'app-icon.ico',
    'README.md',
    'LICENSE',
    '.gitignore'
)

foreach ($file in $files) {
    $filePath = Join-Path $src $file
    if (Test-Path $filePath) {
        Copy-Item -Path $filePath -Destination $dst -Force
        Write-Host "Copied file: $file"
    }
}

# 3. Create release directory with only the installer (<100MB GitHub limit)
# Note: Unpacked portable directory contains a 182MB binary which GitHub rejects.
$releaseDst = Join-Path $dst 'release'
New-Item -ItemType Directory -Force -Path $releaseDst | Out-Null

$installer = Join-Path $src 'release\Attention Path Setup 1.0.0.exe'
if (Test-Path $installer) {
    Copy-Item -Path $installer -Destination $releaseDst -Force
    Write-Host "Copied installer: Attention Path Setup 1.0.0.exe (84MB, < 100MB limit)"
}

# 4. Copy actual current tree screenshot
$screenshotSrc = Join-Path $src 'screenshot-tree.png'
$screenshotDst = Join-Path $dst 'screenshot-tree.png'
if (Test-Path $screenshotSrc) {
    Copy-Item -Path $screenshotSrc -Destination $screenshotDst -Force
    Write-Host "Copied live screenshot: screenshot-tree.png"
}
