@echo off
cd /d "%~dp0"
echo === Foerstegangsopsaetning af Log ===
echo.
echo Trin 1/2: Installerer afhaengigheder...
call npm install
if errorlevel 1 (echo Installation fejlede. & pause & exit /b 1)
echo.
echo Trin 2/2: Opretter database...
call npx tsx scripts/ensure-auth-schema.ts
if errorlevel 1 (echo Migration fejlede. & pause & exit /b 1)
echo.
echo === Klar! ===
echo Konfigurer .env.local (kopi af .env.local.example) med AUTH_SECRET og AUTH_RESEND_KEY.
echo Start derefter appen via start.bat og log ind via magic link paa /login.
pause
