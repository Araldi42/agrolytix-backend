# Script simples para recriar banco Agrolytix
Write-Host "=== SETUP BANCO AGROLYTIX ===" -ForegroundColor Green

# Parar e remover containers/volumes
Write-Host "Limpando ambiente..." -ForegroundColor Blue
docker-compose down -v

# Subir banco de dados
Write-Host "Iniciando banco de dados..." -ForegroundColor Blue
docker-compose up -d postgres

# Aguardar banco ficar pronto
Write-Host "Aguardando banco..." -ForegroundColor Blue
Start-Sleep -Seconds 10

# Subir todos os serviços
Write-Host "Iniciando todos os serviços..." -ForegroundColor Blue
docker-compose up -d

Write-Host ""
Write-Host "=== PRONTO! ===" -ForegroundColor Green
Write-Host "API: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Adminer: http://localhost:8080" -ForegroundColor Cyan
Write-Host "Login: admin@agrolytix.com / admin123" -ForegroundColor Yellow 