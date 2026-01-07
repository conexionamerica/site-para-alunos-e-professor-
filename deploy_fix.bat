@echo off
echo Iniciando deploy alternativo... > deploy_log.txt
echo Fecha: %date% %time% >> deploy_log.txt

echo [1/3] Adicionando arquivos... >> deploy_log.txt
git add src/components/professor-dashboard/PreferenciasTab.jsx >> deploy_log.txt 2>&1

echo [2/3] Commitando... >> deploy_log.txt
git commit -m "fix(Preferencias): correcao critica de horarios (deploy via script)" >> deploy_log.txt 2>&1

echo [3/3] Push para origin main... >> deploy_log.txt
git push origin main >> deploy_log.txt 2>&1

echo Fin del script. >> deploy_log.txt
