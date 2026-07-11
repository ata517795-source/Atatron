@echo off
REM OnePercent - Life Routine Tracker
REM Serves the prebuilt app at http://localhost:4173 (needs Node.js: nodejs.org)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js tidak ditemukan. Install dulu dari https://nodejs.org lalu jalankan lagi.
  pause
  exit /b 1
)
npx --yes http-server dist -p 4173 -o
