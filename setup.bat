@echo off
cd /d "%~dp0"
echo === Foerstegangsopsaetning af Log ===
echo.
echo Trin 1/3: Installerer afhaengigheder...
call npm install
if errorlevel 1 (echo Installation fejlede. & pause & exit /b 1)
echo.
echo Trin 2/3: Opretter database...
call npm run db:migrate
if errorlevel 1 (echo Migration fejlede. & pause & exit /b 1)
echo.
echo Trin 3/3: Opret din bruger
call npm run user:create
echo.
echo === Klar! ===
echo Dobbeltklik start.bat for at starte appen.
pause
