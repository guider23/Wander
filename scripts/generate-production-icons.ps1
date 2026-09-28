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

    # 1. Transparent background outside the rounded corners
    $g.Clear([System.Drawing.Color]::Transparent)

    # 2. Smooth Rounded Squircle Pebble Background (Zero sharp edges, zero black outline)
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
    $g.DrawLine($pen, (tx 256), (ty 356), (tx 256), (ty 332))

    # Botanical Loop with fluid leaf teardrop
    $loopPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    
    $p0 = New-Object System.Drawing.PointF((tx 256), (ty 332))
    $c1 = New-Object System.Drawing.PointF((tx 274), (ty 290))
    $c2 = New-Object System.Drawing.PointF((tx 264), (ty 210))
    $p1 = New-Object System.Drawing.PointF((tx 236), (ty 168))
    $loopPath.AddBezier($p0, $c1, $c2, $p1)

    $c3 = New-Object System.Drawing.PointF((tx 222), (ty 142))
    $c4 = New-Object System.Drawing.PointF((tx 238), (ty 132))
    $p2 = New-Object System.Drawing.PointF((tx 250), (ty 140))
    $loopPath.AddBezier($p1, $c3, $c4, $p2)

    $c5 = New-Object System.Drawing.PointF((tx 262), (ty 148))
    $c6 = New-Object System.Drawing.PointF((tx 250), (ty 172))
    $p3 = New-Object System.Drawing.PointF((tx 236), (ty 188))
    $loopPath.AddBezier($p2, $c5, $c6, $p3)

    $c7 = New-Object System.Drawing.PointF((tx 196), (ty 225))
    $c8 = New-Object System.Drawing.PointF((tx 192), (ty 270))
    $p4 = New-Object System.Drawing.PointF((tx 224), (ty 308))
    $loopPath.AddBezier($p3, $c7, $c8, $p4)

    $c9 = New-Object System.Drawing.PointF((tx 238), (ty 322))
    $c10 = New-Object System.Drawing.PointF((tx 248), (ty 330))
    $p5 = New-Object System.Drawing.PointF((tx 256), (ty 332))
    $loopPath.AddBezier($p4, $c9, $c10, $p5)

    $g.DrawPath($pen, $loopPath)

    # Right side curiosity branch
    $branchPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $bp1 = New-Object System.Drawing.PointF((tx 253), (ty 250))
    $bc1 = New-Object System.Drawing.PointF((tx 264), (ty 224))
    $bc2 = New-Object System.Drawing.PointF((tx 284), (ty 204))
    $bp2 = New-Object System.Drawing.PointF((tx 308), (ty 198))
    $branchPath.AddBezier($bp1, $bc1, $bc2, $bp2)
    $g.DrawPath($pen, $branchPath)

    # Branch ring node
    $ringR = [Math]::Max(2.0, 12.0 * $scale)
    $ringPenWidth = [Math]::Max(1.4, 7.0 * $scale)
    $ringPen = New-Object System.Drawing.Pen($charcoal, $ringPenWidth)
    $ringX = tx 322
    $ringY = ty 198
    $ringRect = New-Object System.Drawing.RectangleF([float]($ringX - $ringR), [float]($ringY - $ringR), [float]($ringR * 2), [float]($ringR * 2))
    $g.FillEllipse($bgBrush, $ringRect)
    $g.DrawEllipse($ringPen, $ringRect)

    # Cleanup
    $pen.Dispose()
    $ringPen.Dispose()
    $fillBrush.Dispose()
    $bgBrush.Dispose()
    $loopPath.Dispose()
    $branchPath.Dispose()
}

function Generate-Png {
    param([int]$size, [string]$path)
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    Draw-WanderMark -g $g -size $size
    $g.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

# 1. Generate 512x512 app-icon.png with smooth rounded squircle corners
$appIconPng = "C:\Users\sidhe\OneDrive\Desktop\Wander\app-icon.png"
Generate-Png -size 512 -path $appIconPng
Write-Host "Generated rounded app-icon.png: $appIconPng"

# 2. Generate multi-res frames for ICO
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$tempPngs = @()
foreach ($sz in $sizes) {
    $tempPath = "C:\Users\sidhe\OneDrive\Desktop\Wander\temp-icon-$sz.png"
    Generate-Png -size $sz -path $tempPath
    $tempPngs += $tempPath
}

# 3. Assemble Windows multi-resolution ICO
$appIconIco = "C:\Users\sidhe\OneDrive\Desktop\Wander\app-icon.ico"
$fs = [System.IO.File]::Create($appIconIco)
$bw = New-Object System.IO.BinaryWriter($fs)

$bw.Write([uint16]0)
$bw.Write([uint16]1)
$bw.Write([uint16]$tempPngs.Length)

$offset = 6 + ($tempPngs.Length * 16)
$bytesList = @()

foreach ($p in $tempPngs) {
    $bytes = [System.IO.File]::ReadAllBytes($p)
    $bytesList += ,$bytes

    $bmp = [System.Drawing.Bitmap]::FromFile($p)
    $w = if ($bmp.Width -ge 256) { 0 } else { [byte]$bmp.Width }
    $h = if ($bmp.Height -ge 256) { 0 } else { [byte]$bmp.Height }
    $bmp.Dispose()

    $bw.Write([byte]$w)
    $bw.Write([byte]$h)
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    $bw.Write([uint16]1)
    $bw.Write([uint16]32)
    $bw.Write([uint32]$bytes.Length)
    $bw.Write([uint32]$offset)
    $offset += $bytes.Length
}

foreach ($bytes in $bytesList) {
    $bw.Write($bytes)
}

$bw.Flush()
$bw.Close()
$fs.Close()

# Delete temp pngs
foreach ($p in $tempPngs) {
    Remove-Item $p -ErrorAction SilentlyContinue
}

Write-Host "Generated rounded app-icon.ico: $appIconIco with 7 resolutions"
