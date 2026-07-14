@echo off
REM ─────────────────────────────────────────────────────────────
REM  Double-click this file to start Greg on Windows.
REM  (It just runs "python run.py" from this folder.)
REM ─────────────────────────────────────────────────────────────
cd /d "%~dp0"
title Greg - laptop assistant
python run.py
echo.
echo Greg stopped. Press any key to close this window.
pause >nul
