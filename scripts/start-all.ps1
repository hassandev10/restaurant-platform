# Smart Restaurant Platform - Full Development Launcher
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Starting Smart Restaurant Platform (Egypt POS & QR)     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Determine base directory dynamically based on script location
$scriptDir = Split-Path -Parent $PSScriptRoot
$baseDir = Split-Path -Parent $scriptDir

# 1. Ensure PostgreSQL is running on 5433
$pgRunning = Get-NetTCPConnection -State Listen -LocalPort 5433 -ErrorAction SilentlyContinue
if (-not $pgRunning) {
    Write-Host "[1/5] Starting PostgreSQL 18 on port 5433..." -ForegroundColor Yellow
    Start-Process -FilePath "C:\Program Files\PostgreSQL\18\bin\postgres.exe" -ArgumentList "-D D:\pgdata_smart_restaurant" -WindowStyle Hidden
    Start-Sleep -Seconds 3
} else {
    Write-Host "[1/5] PostgreSQL 18 is already running on port 5433." -ForegroundColor Green
}

# 2. Start Go Backend on 8080
$apiRunning = Get-NetTCPConnection -State Listen -LocalPort 8080 -ErrorAction SilentlyContinue
if (-not $apiRunning) {
    Write-Host "[2/5] Starting Go Backend on port 8080..." -ForegroundColor Yellow
    Start-Process -FilePath "$baseDir\smart-restaurant-api\smart-restaurant-api.exe" -WorkingDirectory "$baseDir\smart-restaurant-api"
    Start-Sleep -Seconds 2
} else {
    Write-Host "[2/5] Go Backend is already running on port 8080." -ForegroundColor Green
}

# 3. Start Customer Ordering Client on 3000
Write-Host "[3/5] Starting Customer Ordering Client on http://localhost:3000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$baseDir\smart-restaurant'; npm run dev"

# 4. Start Incoming Orders Dashboard on 3001
Write-Host "[4/5] Starting Incoming Orders Dashboard on http://localhost:3001..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$baseDir\smart-restaurant-dashboard'; npx next dev -p 3001"

# 5. Start Admin Client on 3002
Write-Host "[5/5] Starting Admin Management Client on http://localhost:3002..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$baseDir\smart-restaurant-admin'; npm run dev"

Write-Host "`nAll services have been launched successfully!" -ForegroundColor Green
Write-Host "  - Backend API: http://localhost:8080/health" -ForegroundColor Cyan
Write-Host "  - Customer QR Menu: http://localhost:3000/r/demo-restaurant/t/demo-table-token" -ForegroundColor Cyan
Write-Host "  - Staff Dashboard: http://localhost:3001/orders" -ForegroundColor Cyan
Write-Host "  - Admin Portal: http://localhost:3002" -ForegroundColor Cyan
