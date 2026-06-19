@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-ev-charger-cache.ps1" %*
