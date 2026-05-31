@echo off
cd /d "%~dp0"
echo === Log (udvikling) ===
echo Starter dev-server med hot-reload paa http://localhost:3000
echo Tryk Ctrl+C i dette vindue for at lukke.
npm run dev
