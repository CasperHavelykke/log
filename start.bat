@echo off
cd /d "%~dp0"
echo === Log ===
echo Bygger app (tager nogle sekunder)...
call npm run build
if errorlevel 1 (
  echo Build fejlede.
  pause
  exit /b 1
)
echo.
echo Aabner http://localhost:3000 om lidt og starter serveren...
echo Tryk Ctrl+C i dette vindue for at lukke serveren.
start "" cmd /c "timeout /t 5 /nobreak >nul && start http://localhost:3000"
npm run start
