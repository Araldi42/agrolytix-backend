# Script de Setup Completo - Agrolytix Backend
# Este script automatiza todo o processo de instalação e validação

param(
    [switch]$SkipValidation = $false
)

Write-Host "🌱 AGROLYTIX BACKEND - SETUP COMPLETO" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green

# Função para verificar se comando existe
function Test-Command {
    param($Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Função para aguardar serviço
function Wait-ForService {
    param($Url, $ServiceName, $MaxAttempts = 30)
    
    Write-Host "Aguardando $ServiceName..." -ForegroundColor Yellow
    
    for ($i = 1; $i -le $MaxAttempts; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -TimeoutSec 5 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ $ServiceName está funcionando!" -ForegroundColor Green
                return $true
            }
        }
        catch {
            Write-Host "⏳ Tentativa $i/$MaxAttempts..." -ForegroundColor Gray
            Start-Sleep -Seconds 2
        }
    }
    
    Write-Host "❌ $ServiceName não respondeu após $MaxAttempts tentativas" -ForegroundColor Red
    return $false
}

# 1. VERIFICAR PRÉ-REQUISITOS
Write-Host "`n📋 1. VERIFICANDO PRÉ-REQUISITOS..." -ForegroundColor Cyan

# Verificar Docker
if (-not (Test-Command "docker")) {
    Write-Host "❌ Docker não encontrado!" -ForegroundColor Red
    Write-Host "   Instale o Docker Desktop: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Command "docker-compose")) {
    Write-Host "❌ Docker Compose não encontrado!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Docker encontrado:" -ForegroundColor Green
docker --version
docker-compose --version

# Verificar Git
if (-not (Test-Command "git")) {
    Write-Host "❌ Git não encontrado!" -ForegroundColor Red
    Write-Host "   Instale o Git: https://git-scm.com/downloads" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Git encontrado:" -ForegroundColor Green
git --version

# 2. CONFIGURAR AMBIENTE
Write-Host "`n🔧 2. CONFIGURANDO AMBIENTE..." -ForegroundColor Cyan

# Verificar se .env existe
if (-not (Test-Path ".env")) {
    if (Test-Path "env.example") {
        Write-Host "📄 Criando arquivo .env..." -ForegroundColor Yellow
        Copy-Item "env.example" ".env"
        Write-Host "✅ Arquivo .env criado com configurações padrão" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Arquivo env.example não encontrado" -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ Arquivo .env já existe" -ForegroundColor Green
}

# 3. PARAR CONTAINERS EXISTENTES
Write-Host "`n🛑 3. PARANDO CONTAINERS EXISTENTES..." -ForegroundColor Cyan
docker-compose down -v 2>$null
Write-Host "✅ Containers parados" -ForegroundColor Green

# 4. CONSTRUIR IMAGENS
Write-Host "`n🔨 4. CONSTRUINDO IMAGENS DOCKER..." -ForegroundColor Cyan
Write-Host "   (Isso pode levar alguns minutos na primeira vez)" -ForegroundColor Gray

$buildResult = docker-compose build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao construir imagens Docker!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Imagens construídas com sucesso" -ForegroundColor Green

# 5. INICIAR SERVIÇOS
Write-Host "`n🚀 5. INICIANDO SERVIÇOS..." -ForegroundColor Cyan

$startResult = docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao iniciar serviços!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Serviços iniciados" -ForegroundColor Green

# 6. AGUARDAR SERVIÇOS
Write-Host "`n⏳ 6. AGUARDANDO SERVIÇOS FICAREM PRONTOS..." -ForegroundColor Cyan

# Aguardar PostgreSQL
Write-Host "Aguardando PostgreSQL..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Aguardar API
if (-not (Wait-ForService "http://localhost:3000" "API")) {
    Write-Host "❌ API não iniciou corretamente" -ForegroundColor Red
    Write-Host "Verificando logs..." -ForegroundColor Yellow
    docker-compose logs app
    exit 1
}

# Aguardar Health Check
if (-not (Wait-ForService "http://localhost:3000/api/saude" "Health Check")) {
    Write-Host "❌ Health Check falhou" -ForegroundColor Red
    exit 1
}

# 7. CONFIGURAR USUÁRIO ADMIN
Write-Host "`n👤 7. CONFIGURANDO USUÁRIO ADMIN.." -ForegroundColor Cyan

if (Test-Path "scripts/setup-admin.ps1") {
    & "scripts/setup-admin.ps1"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erro ao configurar usuário admin!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⚠️ Script setup-admin.ps1 não encontrado" -ForegroundColor Yellow
    Write-Host "   Configurando manualmente..." -ForegroundColor Gray
    
    $senha = "$2b$10$/gZHrGgR/5XmStju61NzPOClTwsAJWYRH5b4zeG.c246/W6sl1XZe"
    $updateQuery = "UPDATE usuarios SET senha = ''$senha'', perfil_id = 1 WHERE email = ''admin@agrolytix.com'';"
    docker-compose exec postgres psql -U agrolytix_user -d agrolytix_db -c "$updateQuery"
}

# 8. VERIFICAR STATUS
Write-Host "`n📊 8. VERIFICANDO STATUS DOS CONTAINERS..." -ForegroundColor Cyan
docker-compose ps

# 9. VALIDAÇÃO COMPLETA
if (-not $SkipValidation) {
    Write-Host "`n✅ 9. EXECUTANDO VALIDAÇÃO COMPLETA..." -ForegroundColor Cyan
    
    if (Test-Path "scripts/test-api.ps1") {
        & "scripts/test-api.ps1"
    } else {
        Write-Host "⚠️ Script test-api.ps1 não encontrado" -ForegroundColor Yellow
        Write-Host "   Executando teste básico..." -ForegroundColor Gray
        
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:3000/" -TimeoutSec 10
            if ($response.sucesso) {
                Write-Host "✅ API respondendo corretamente" -ForegroundColor Green
            }
        }
        catch {
            Write-Host "❌ Erro ao testar API: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# 10. RESUMO FINAL
Write-Host "`n🎉 SETUP COMPLETO!" -ForegroundColor Green
Write-Host "=================" -ForegroundColor Green

Write-Host "`n📍 SERVIÇOS DISPONÍVEIS:" -ForegroundColor Cyan
Write-Host "• API: http://localhost:3000" -ForegroundColor White
Write-Host "• Health Check: http://localhost:3000/api/saude" -ForegroundColor White
Write-Host "• Adminer (DB): http://localhost:8080" -ForegroundColor White
Write-Host "• PostgreSQL: localhost:5432" -ForegroundColor White
Write-Host "• Redis: localhost:6379" -ForegroundColor White

Write-Host "`n🔐 CREDENCIAIS DE TESTE:" -ForegroundColor Cyan
Write-Host "• Email/Login: admin@agrolytix.com" -ForegroundColor White
Write-Host "• Senha: admin123" -ForegroundColor White

Write-Host "`n📚 PRÓXIMOS PASSOS:" -ForegroundColor Cyan
Write-Host "1. Importar collection no Postman:" -ForegroundColor White
Write-Host "   - postman/Agrolytix-API.postman_collection.json" -ForegroundColor Gray
Write-Host "   - postman/Agrolytix-Environment.postman_environment.json" -ForegroundColor Gray
Write-Host "2. Ler documentação:" -ForegroundColor White
Write-Host "   - README.md" -ForegroundColor Gray
Write-Host "   - postman/INICIO-RAPIDO.md" -ForegroundColor Gray
Write-Host "3. Testar endpoints no Postman" -ForegroundColor White

Write-Host "`n🔧 COMANDOS ÚTEIS:" -ForegroundColor Cyan
Write-Host "• Ver logs: docker-compose logs -f app" -ForegroundColor White
Write-Host "• Parar: docker-compose down" -ForegroundColor White
Write-Host "• Reiniciar: docker-compose restart" -ForegroundColor White
Write-Host "• Testar API: .\scripts\test-api.ps1" -ForegroundColor White

Write-Host "`n🌱 Agrolytix Backend está pronto para uso!" -ForegroundColor Green 