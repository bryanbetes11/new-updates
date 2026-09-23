$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$repoRoot = Split-Path $PSScriptRoot -Parent
$source = [System.Drawing.Image]::FromFile((Join-Path $repoRoot 'public/servesync-app-icon.png'))
try {
    foreach ($entry in @(@('mdpi',48,108), @('hdpi',72,162), @('xhdpi',96,216), @('xxhdpi',144,324), @('xxxhdpi',192,432))) {
        $folder = Join-Path $repoRoot ('android/app/src/main/res/mipmap-' + $entry[0])
        foreach ($name in @('ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground')) {
            $size = if ($name -eq 'ic_launcher_foreground') { [int]$entry[2] } else { [int]$entry[1] }
            $bitmap = [System.Drawing.Bitmap]::new($size, $size)
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            try {
                $graphics.Clear([System.Drawing.Color]::Black)
                $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                # Adaptive launchers crop the outer layer; inset the artwork to keep breathing room.
                $artSize = [int][Math]::Round($size * 0.80)
                $inset = [int][Math]::Floor(($size - $artSize) / 2)
                $graphics.DrawImage($source, $inset, $inset, $artSize, $artSize)
                $bitmap.Save((Join-Path $folder ($name + '.png')), [System.Drawing.Imaging.ImageFormat]::Png)
            } finally { $graphics.Dispose(); $bitmap.Dispose() }
        }
    }
} finally { $source.Dispose() }
Write-Output 'Generated Android launcher densities from the existing ServeSync app icon.'
