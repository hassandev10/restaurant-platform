# Stop Smart Restaurant processes
Write-Host "Stopping Go API and Node.js dev servers..." -ForegroundColor Yellow

Get-Process -Name "smart-restaurant-api" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Applications stopped successfully." -ForegroundColor Green
