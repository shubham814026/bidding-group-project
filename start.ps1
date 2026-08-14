# BidForge - Start Script
# Seeds the database, then launches both the server and client in separate PowerShell windows

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   BidForge - Starting Application...   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Kill any existing processes on ports 5000 and 3000
Write-Host "[0/3] Freeing ports 5000 and 3000..." -ForegroundColor Magenta
Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

# Run the database seed script
Write-Host "[1/3] Seeding the database..." -ForegroundColor Yellow
Push-Location "d:\bidforge\server"
node seed.js
Pop-Location

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  ERROR: Seeding failed! Check the output above." -ForegroundColor Red
    Write-Host "  The servers will still start, but the database may be empty." -ForegroundColor Red
    Write-Host ""
}

# Start the backend server
Write-Host "[2/3] Starting Backend Server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'd:\bidforge\server'; Write-Host 'Starting BidForge Server on port 5000...' -ForegroundColor Green; npm run dev"

# Start the frontend client
Write-Host "[3/3] Starting Frontend Client..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'd:\bidforge\client'; Write-Host 'Starting BidForge Client on port 3000...' -ForegroundColor Green; npm run dev"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Both servers are starting!           " -ForegroundColor Green
Write-Host "   Server: http://localhost:5000        " -ForegroundColor White
Write-Host "   Client: http://localhost:3000        " -ForegroundColor White
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
