param([string]$name)
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$html = (Join-Path $here "$name.html") -replace '\\','/'
& $chrome --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$here\prof" --allow-file-access-from-files --force-device-scale-factor=3 --window-size=1664,700 --virtual-time-budget=15000 --screenshot="$here\$name.png" "file:///$html" 2>$null | Out-Null
Get-Item "$here\$name.png" | Select-Object Name, Length
