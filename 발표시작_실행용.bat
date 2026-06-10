@echo off
title 성남시 부동산 GIS 대시보드 로컬 서버
cd /d "%~dp0"
echo ====================================================
echo  성남시 부동산 GIS 대시보드 서버를 시작합니다.
echo  학교 발표 컴퓨터에서도 이 파일만 클릭하시면 작동합니다.
echo ====================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File server.ps1
pause
