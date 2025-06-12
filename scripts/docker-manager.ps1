# Script de gerenciamento do ambiente Docker Agrolytix para Windows
# Uso: .\scripts\docker-manager.ps1 [comando]

param(
    [Parameter(Position=0)]
    [string]$Command = "help"
)

# Cores para output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Cyan"

# Função para exibir ajuda
function Show-Help {
    Write-Host "=== Agrolytix Docker Manager ===" -ForegroundColor $Blue
    Write-Host ""
    Write-Host "Comandos disponíveis:" -ForegroundColor White
    Write-Host ""
    Write-Host "setup        " -ForegroundColor $Green -NoNewline; Write-Host "- Configuração inicial completa"
    Write-Host "start        " -ForegroundColor $Green -NoNewline; Write-Host "- Iniciar todos os serviços"
    Write-Host "stop         " -ForegroundColor $Green -NoNewline; Write-Host "- Parar todos os serviços"
    Write-Host "restart      " -ForegroundColor $Green -NoNewline; Write-Host "- Reiniciar todos os serviços"
    Write-Host "logs         " -ForegroundColor $Green -NoNewline; Write-Host "- Visualizar logs dos serviços"
    Write-Host "db-only      " -ForegroundColor $Green -NoNewline; Write-Host "- Iniciar apenas o banco de dados"
    Write-Host "backup       " -ForegroundColor $Green -NoNewline; Write-Host "- Fazer backup do banco de dados"
    Write-Host "restore      " -ForegroundColor $Green -NoNewline; Write-Host "- Restaurar backup do banco"
    Write-Host "clean        " -ForegroundColor $Green -NoNewline; Write-Host "- Limpar containers e volumes"
    Write-Host "status       " -ForegroundColor $Green -NoNewline; Write-Host "- Status dos serviços"
    Write-Host "shell        " -ForegroundColor $Green -NoNewline; Write-Host "- Acessar shell do container da app"
    Write-Host "db-shell     " -ForegroundColor $Green -NoNewline; Write-Host "- Acessar shell do PostgreSQL"
    Write-Host ""
}

# Função para verificar se Docker está rodando
function Test-Docker {
    try {
        docker info | Out-Null
        return $true
    }
    catch {
        Write-Host "❌ Docker não está rodando!" -ForegroundColor $Red
        return $false
    }
}

# Função para configuração inicial
function Invoke-Setup {
    Write-Host "🚀 Configurando ambiente Agrolytix..." -ForegroundColor $Blue
    
    # Criar diretórios necessários
    New-Item -ItemType Directory -Force -Path "database\init" | Out-Null
    New-Item -ItemType Directory -Force -Path "database\backups" | Out-Null
    New-Item -ItemType Directory -Force -Path "logs" | Out-Null
    
    # Copiar arquivo de ambiente se não existir
    if (-not (Test-Path ".env")) {
        if (Test-Path "env.example") {
            Copy-Item "env.example" ".env"
            Write-Host "✅ Arquivo .env criado a partir do env.example" -ForegroundColor $Green
        }
        else {
            Write-Host "⚠️  Arquivo env.example não encontrado" -ForegroundColor $Yellow
        }
    }
    
    # Build das imagens
    Write-Host "🔨 Fazendo build das imagens..." -ForegroundColor $Blue
    docker-compose build
    
    # Iniciar serviços
    Write-Host "🚀 Iniciando serviços..." -ForegroundColor $Blue
    docker-compose up -d postgres redis
    
    # Aguardar banco ficar pronto
    Write-Host "⏳ Aguardando banco de dados ficar pronto..." -ForegroundColor $Blue
    Start-Sleep -Seconds 10
    
    Write-Host "✅ Configuração inicial concluída!" -ForegroundColor $Green
    Write-Host "🌐 Acesse o Adminer em: http://localhost:8080" -ForegroundColor $Blue
    Write-Host "📊 Dados de conexão:" -ForegroundColor $Blue
    Write-Host "   Sistema: PostgreSQL"
    Write-Host "   Servidor: postgres"
    Write-Host "   Usuário: agrolytix_user"
    Write-Host "   Senha: agrolytix_2024"
    Write-Host "   Base: agrolytix_db"
}

# Função para iniciar serviços
function Start-Services {
    Write-Host "🚀 Iniciando serviços Agrolytix..." -ForegroundColor $Blue
    docker-compose up -d
    Write-Host "✅ Serviços iniciados!" -ForegroundColor $Green
    Get-Status
}

# Função para parar serviços
function Stop-Services {
    Write-Host "🛑 Parando serviços Agrolytix..." -ForegroundColor $Yellow
    docker-compose down
    Write-Host "✅ Serviços parados!" -ForegroundColor $Green
}

# Função para reiniciar serviços
function Restart-Services {
    Write-Host "🔄 Reiniciando serviços Agrolytix..." -ForegroundColor $Blue
    docker-compose restart
    Write-Host "✅ Serviços reiniciados!" -ForegroundColor $Green
}

# Função para visualizar logs
function Show-Logs {
    Write-Host "📋 Logs dos serviços:" -ForegroundColor $Blue
    docker-compose logs -f --tail=100
}

# Função para iniciar apenas banco
function Start-DatabaseOnly {
    Write-Host "🗄️  Iniciando apenas banco de dados..." -ForegroundColor $Blue
    docker-compose up -d postgres adminer
    Write-Host "✅ Banco de dados iniciado!" -ForegroundColor $Green
    Write-Host "🌐 Adminer disponível em: http://localhost:8080" -ForegroundColor $Blue
}

# Função para backup
function Invoke-Backup {
    Write-Host "💾 Fazendo backup do banco de dados..." -ForegroundColor $Blue
    
    $BackupFile = "database\backups\agrolytix_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
    
    docker-compose exec postgres pg_dump -U agrolytix_user -d agrolytix_db > $BackupFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Backup criado: $BackupFile" -ForegroundColor $Green
    }
    else {
        Write-Host "❌ Erro ao criar backup!" -ForegroundColor $Red
    }
}

# Função para restaurar backup
function Invoke-Restore {
    Write-Host "⚠️  Esta operação irá substituir todos os dados atuais!" -ForegroundColor $Yellow
    $Confirm = Read-Host "Tem certeza? (s/N)"
    
    if ($Confirm -eq "s" -or $Confirm -eq "S") {
        $BackupFile = Read-Host "Digite o caminho do arquivo de backup"
        
        if (Test-Path $BackupFile) {
            Write-Host "🔄 Restaurando backup..." -ForegroundColor $Blue
            Get-Content $BackupFile | docker-compose exec -T postgres psql -U agrolytix_user -d agrolytix_db
            Write-Host "✅ Backup restaurado!" -ForegroundColor $Green
        }
        else {
            Write-Host "❌ Arquivo não encontrado: $BackupFile" -ForegroundColor $Red
        }
    }
    else {
        Write-Host "Operação cancelada." -ForegroundColor $Yellow
    }
}

# Função para limpeza
function Invoke-Clean {
    Write-Host "⚠️  Esta operação irá remover todos os containers e volumes!" -ForegroundColor $Yellow
    $Confirm = Read-Host "Tem certeza? (s/N)"
    
    if ($Confirm -eq "s" -or $Confirm -eq "S") {
        Write-Host "🧹 Limpando ambiente..." -ForegroundColor $Blue
        docker-compose down -v --remove-orphans
        docker system prune -f
        Write-Host "✅ Limpeza concluída!" -ForegroundColor $Green
    }
    else {
        Write-Host "Operação cancelada." -ForegroundColor $Yellow
    }
}

# Função para status
function Get-Status {
    Write-Host "📊 Status dos serviços:" -ForegroundColor $Blue
    docker-compose ps
}

# Função para shell da aplicação
function Enter-AppShell {
    Write-Host "🐚 Acessando shell da aplicação..." -ForegroundColor $Blue
    docker-compose exec app sh
}

# Função para shell do banco
function Enter-DatabaseShell {
    Write-Host "🗄️  Acessando shell do PostgreSQL..." -ForegroundColor $Blue
    docker-compose exec postgres psql -U agrolytix_user -d agrolytix_db
}

# Verificar Docker
if (-not (Test-Docker)) {
    exit 1
}

# Processar comando
switch ($Command.ToLower()) {
    "setup" { Invoke-Setup }
    "start" { Start-Services }
    "stop" { Stop-Services }
    "restart" { Restart-Services }
    "logs" { Show-Logs }
    "db-only" { Start-DatabaseOnly }
    "backup" { Invoke-Backup }
    "restore" { Invoke-Restore }
    "clean" { Invoke-Clean }
    "status" { Get-Status }
    "shell" { Enter-AppShell }
    "db-shell" { Enter-DatabaseShell }
    default { Show-Help }
} 