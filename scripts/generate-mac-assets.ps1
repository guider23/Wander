Add-Type -AssemblyName System.Drawing

function Draw-WanderMark {
    param(
        [System.Drawing.Graphics]$g,
        [int]$size
    )

    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $peach = [System.Drawing.Color]::FromArgb(245, 230, 216)
    $charcoal = [System.Drawing.Color]::FromArgb(24, 24, 24)

    # 1. Transparent background
    $g.Clear([System.Drawing.Color]::Transparent)

    # 2. Smooth Rounded Squircle Pebble Background
    $margin = [Math]::Max(1.0, 8.0 * ($size / 512.0))
    $rectW = $size - (2.0 * $margin)
    $rectH = $size - (2.0 * $margin)
    $radius = $rectW * 0.225
    $diam = $radius * 2.0

    $sqPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $sqPath.AddArc([float]$margin, [float]$margin, [float]$diam, [float]$diam, 180, 90)
    $sqPath.AddArc([float]($margin + $rectW - $diam), [float]$margin, [float]$diam, [float]$diam, 270, 90)
    $sqPath.AddArc([float]($margin + $rectW - $diam), [float]($margin + $rectH - $diam), [float]$diam, [float]$diam, 0, 90)
    $sqPath.AddArc([float]$margin, [float]($margin + $rectH - $diam), [float]$diam, [float]$diam, 90, 90)
    $sqPath.CloseFigure()

    $peachBrush = New-Object System.Drawing.SolidBrush($peach)
    $g.FillPath($peachBrush, $sqPath)
    $peachBrush.Dispose()
    $sqPath.Dispose()

    # 3. Coordinate mapping for centered vector logo
    $scale = ($size / 512.0) * 1.32
    $cx = $size / 2.0
    $cy = $size / 2.0
    function tx([float]$x) { return [float]($cx + ($x - 256.0) * $scale) }
    function ty([float]$y) { return [float]($cy + ($y - 256.0) * $scale) }

    $penWidth = [Math]::Max(1.8, 9.5 * $scale)
    $pen = New-Object System.Drawing.Pen($charcoal, $penWidth)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    $fillBrush = New-Object System.Drawing.SolidBrush($charcoal)
    $bgBrush = New-Object System.Drawing.SolidBrush($peach)

    # Root Node circle
    $rootR = [Math]::Max(2.0, 12.0 * $scale)
    $rootX = tx 256
    $rootY = ty 368
    $g.FillEllipse($fillBrush, [float]($rootX - $rootR), [float]($rootY - $rootR), [float]($rootR * 2), [float]($rootR * 2))

    # Lower stem
    $g.DrawLine($pen, [float](tx 256), [float](ty 368), [float](tx 256), [float](ty 275))

    # Left curiosity branch
    $leftBranch = New-Object System.Drawing.Drawing2D.GraphicsPath
    $leftBranch.AddBezier(
        [float](tx 256), [float](ty 310),
        [float](tx 218), [float](ty 295),
        [float](tx 175), [float](ty 260),
        [float](tx 164), [float](ty 210)
    )
    $g.DrawPath($pen, $leftBranch)
    $leftBranch.Dispose()

    # Left branch sub-sprout
    $leftSub = New-Object System.Drawing.Drawing2D.GraphicsPath
    $leftSub.AddBezier(
        [float](tx 198), [float](ty 280),
        [float](tx 170), [float](ty 292),
        [float](tx 148), [float](ty 308),
        [float](tx 138), [float](ty 328)
    )
    $g.DrawPath($pen, $leftSub)
    $leftSub.Dispose()

    # Left completed node
    $leftSubR = [Math]::Max(2.0, 9.0 * $scale)
    $lsX = tx 138
    $lsY = ty 328
    $g.FillEllipse($fillBrush, [float]($lsX - $leftSubR), [float]($lsY - $leftSubR), [float]($leftSubR * 2), [float]($leftSubR * 2))

    # Left terminal node (open ring)
    $leftTipR = [Math]::Max(2.5, 11.5 * $scale)
    $ltX = tx 164
    $ltY = ty 210
    $g.FillEllipse($bgBrush, [float]($ltX - $leftTipR), [float]($ltY - $leftTipR), [float]($leftTipR * 2), [float]($leftTipR * 2))
    $g.DrawEllipse($pen, [float]($ltX - $leftTipR), [float]($ltY - $leftTipR), [float]($leftTipR * 2), [float]($leftTipR * 2))

    # Central stem
    $g.DrawLine($pen, [float](tx 256), [float](ty 275), [float](tx 256), [float](ty 165))

    # Right curiosity branch
    $rightBranch = New-Object System.Drawing.Drawing2D.GraphicsPath
    $rightBranch.AddBezier(
        [float](tx 256), [float](ty 240),
        [float](tx 295), [float](ty 232),
        [float](tx 335), [float](ty 212),
        [float](tx 350), [float](ty 180)
    )
    $g.DrawPath($pen, $rightBranch)
    $rightBranch.Dispose()

    # Right terminal node (completed filled)
    $rightTipR = [Math]::Max(2.0, 10.0 * $scale)
    $rtX = tx 350
    $rtY = ty 180
    $g.FillEllipse($fillBrush, [float]($rtX - $rightTipR), [float]($rtY - $rightTipR), [float]($rightTipR * 2), [float]($rightTipR * 2))

    # Growing Tip (Top focus ring with center pip)
    $topTipR = [Math]::Max(2.8, 13.0 * $scale)
    $ttX = tx 256
    $ttY = ty 165
    $g.FillEllipse($bgBrush, [float]($ttX - $topTipR), [float]($ttY - $topTipR), [float]($topTipR * 2), [float]($topTipR * 2))
    $g.DrawEllipse($pen, [float]($ttX - $topTipR), [float]($ttY - $topTipR), [float]($topTipR * 2), [float]($topTipR * 2))

    $pipR = [Math]::Max(1.0, 4.0 * $scale)
    $g.FillEllipse($fillBrush, [float]($ttX - $pipR), [float]($ttY - $pipR), [float]($pipR * 2), [float]($pipR * 2))

    $pen.Dispose()
    $fillBrush.Dispose()
    $bgBrush.Dispose()
}

function Draw-MenuTemplateMark {
    param(
        [System.Drawing.Graphics]$g,
        [int]$size
    )

    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $black = [System.Drawing.Color]::FromArgb(0, 0, 0)
    $g.Clear([System.Drawing.Color]::Transparent)

    $scale = ($size / 22.0)
    $pen = New-Object System.Drawing.Pen($black, [Math]::Max(1.4, 1.4 * $scale))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $fillBrush = New-Object System.Drawing.SolidBrush($black)

    # Simple clean botanical stem for 22px / 44px menu bar
    $cx = $size / 2.0
    # Central stem
    $g.DrawLine($pen, [float]($cx), [float](17.0 * $scale), [float]($cx), [float](5.0 * $scale))
    # Root dot
    $g.FillEllipse($fillBrush, [float]($cx - 1.2 * $scale), [float](17.0 * $scale - 1.2 * $scale), [float](2.4 * $scale), [float](2.4 * $scale))
    # Left branch
    $g.DrawArc($pen, [float]($cx - 6.5 * $scale), [float](7.0 * $scale), [float](7.0 * $scale), [float](7.0 * $scale), 30, 110)
    # Right branch
    $g.DrawArc($pen, [float]($cx - 0.5 * $scale), [float](8.0 * $scale), [float](6.5 * $scale), [float](6.5 * $scale), 200, 120)
    # Growing tip circle
    $tipR = 1.8 * $scale
    $g.DrawEllipse($pen, [float]($cx - $tipR), [float](5.0 * $scale - $tipR), [float]($tipR * 2), [float]($tipR * 2))

    $pen.Dispose()
    $fillBrush.Dispose()
}

# 1. Render PNG images to memory
$sizes = @(
    @{ Tag = 'ic04'; Size = 16 },
    @{ Tag = 'ic05'; Size = 32 },
    @{ Tag = 'ic11'; Size = 32 },
    @{ Tag = 'ic12'; Size = 64 },
    @{ Tag = 'ic07'; Size = 128 },
    @{ Tag = 'ic08'; Size = 256 },
    @{ Tag = 'ic14'; Size = 512 },
    @{ Tag = 'ic09'; Size = 512 },
    @{ Tag = 'ic10'; Size = 1024 }
)

$pngChunks = @()
foreach ($item in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap $item.Size, $item.Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    Draw-WanderMark -g $g -size $item.Size
    $g.Dispose()

    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $bytes = $ms.ToArray()
    $ms.Dispose()

    $pngChunks += @{
        Tag = $item.Tag
        Data = $bytes
    }
}

# 2. Package Apple ICNS container
# Header: 4 bytes 'icns' + 4 bytes total file length (Big Endian)
# Chunks: 4 bytes Tag + 4 bytes chunk length (8 + data.Length, Big Endian) + data
$totalLength = 8
foreach ($c in $pngChunks) {
    $totalLength += (8 + $c.Data.Length)
}

$icnsStream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($icnsStream)

# Write 'icns' magic
$writer.Write([System.Text.Encoding]::ASCII.GetBytes("icns"))

# Write total file length in Big Endian
function Write-UInt32BE([System.IO.BinaryWriter]$w, [uint32]$val) {
    $bytes = [System.BitConverter]::GetBytes($val)
    if ([System.BitConverter]::IsLittleEndian) { [Array]::Reverse($bytes) }
    $w.Write($bytes)
}

Write-UInt32BE $writer ([uint32]$totalLength)

# Write chunks
foreach ($c in $pngChunks) {
    $tagBytes = [System.Text.Encoding]::ASCII.GetBytes($c.Tag)
    $writer.Write($tagBytes)
    $chunkLen = [uint32](8 + $c.Data.Length)
    Write-UInt32BE $writer $chunkLen
    $writer.Write($c.Data)
}

$writer.Flush()
$icnsBytes = $icnsStream.ToArray()
$writer.Dispose()
$icnsStream.Dispose()

# Save app-icon.icns
$icnsPath1 = "c:\Users\sidhe\OneDrive\Desktop\Wander\app-icon.icns"
$icnsPath2 = "C:\Users\sidhe\OneDrive\Desktop\wander-opensource\app-icon.icns"
[System.IO.File]::WriteAllBytes($icnsPath1, $icnsBytes)
[System.IO.File]::WriteAllBytes($icnsPath2, $icnsBytes)
Write-Host "Generated app-icon.icns: $($icnsBytes.Length) bytes"

# 3. Generate macOS Menu Bar Template PNGs (22x22 and 44x44 @2x)
$t1 = New-Object System.Drawing.Bitmap 22, 22, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gt1 = [System.Drawing.Graphics]::FromImage($t1)
Draw-MenuTemplateMark -g $gt1 -size 22
$gt1.Dispose()
$t1.Save("c:\Users\sidhe\OneDrive\Desktop\Wander\tray-Template.png", [System.Drawing.Imaging.ImageFormat]::Png)
$t1.Save("C:\Users\sidhe\OneDrive\Desktop\wander-opensource\tray-Template.png", [System.Drawing.Imaging.ImageFormat]::Png)
$t1.Dispose()

$t2 = New-Object System.Drawing.Bitmap 44, 44, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gt2 = [System.Drawing.Graphics]::FromImage($t2)
Draw-MenuTemplateMark -g $gt2 -size 44
$gt2.Dispose()
$t2.Save("c:\Users\sidhe\OneDrive\Desktop\Wander\tray-Template@2x.png", [System.Drawing.Imaging.ImageFormat]::Png)
$t2.Save("C:\Users\sidhe\OneDrive\Desktop\wander-opensource\tray-Template@2x.png", [System.Drawing.Imaging.ImageFormat]::Png)
$t2.Dispose()

Write-Host "Generated tray-Template.png and tray-Template@2x.png for macOS menu bar"
