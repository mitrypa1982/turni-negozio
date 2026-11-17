@echo off
title Gestione Turni Negozio
echo Avvio del server locale per il gestionale turni...
cd /d "%~dp5"
start http://localhost:4173
npm run preview
pause