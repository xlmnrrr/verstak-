# Этап 8: значки из собранного Верстак.exe и обоих ярлыков (рабочий стол, «Пуск») в одну картинку проверка\v2\8-значки-ярлыки.png.
# Весь экран не снимаем: на нём чужие окна.
Add-Type -AssemblyName System.Drawing
$w = New-Object -ComObject WScript.Shell
$пути = @(
  @{ имя = 'Верстак.exe'; путь = 'C:\VerstakTest\Верстак.exe' },
  @{ имя = 'Рабочий стол'; путь = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Верстак.lnk') },
  @{ имя = 'Пуск'; путь = (Join-Path ([Environment]::GetFolderPath('Programs')) 'Верстак.lnk') }
)
$bmp = New-Object System.Drawing.Bitmap 420, 150
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::FromArgb(36, 30, 24))
$шрифт = New-Object System.Drawing.Font 'Segoe UI', 10
$кисть = [System.Drawing.Brushes]::White
$x = 20
foreach ($п in $пути) {
  $цель = $п.путь
  if ($цель -like '*.lnk') { $цель = $w.CreateShortcut($цель).TargetPath }
  $иконка = [System.Drawing.Icon]::ExtractAssociatedIcon($цель)
  $g.DrawIcon($иконка, $x + 20, 30)
  $g.DrawString($п.имя, $шрифт, $кисть, $x - 5, 90)
  $g.DrawString((Test-Path $п.путь), $шрифт, $кисть, $x + 20, 112)
  $x += 135
}
$bmp.Save((Join-Path (Get-Location) 'проверка\v2\8-значки-ярлыки.png'))
$g.Dispose(); $bmp.Dispose()
