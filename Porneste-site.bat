@echo off
chcp 65001 >nul
title Site CFC Royal - server local
cd /d "%~dp0"

echo ============================================================
echo   Site local - Club Federal Chinologic Royal
echo ============================================================
echo.

if not exist "node_modules\" (
  echo Prima rulare: instalez dependintele ^(o singura data, 1-2 min^)...
  call npm install
  echo.
)

echo Deschid browserul si pornesc serverul...
echo Daca pagina arata o eroare la inceput, reincarca ^(F5^) dupa 3-4 secunde.
echo.
echo   Adresa: http://localhost:4321/
echo.
echo Lasa ACEASTA fereastra deschisa cat vrei sa vezi site-ul.
echo Opreste serverul cu Ctrl+C sau inchizand fereastra.
echo.

start "" "http://localhost:4321/"
call npm run dev

echo.
echo Serverul s-a oprit.
pause
