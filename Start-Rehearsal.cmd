@echo off
cd /d "%~dp0"
node scripts/start-rehearsal.mjs
if errorlevel 1 pause
