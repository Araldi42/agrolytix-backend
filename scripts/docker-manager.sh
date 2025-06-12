#!/bin/bash

# Script de gerenciamento do ambiente Docker Agrolytix
# Uso: ./scripts/docker-manager.sh [comando]

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para exibir ajuda
show_help() {
    echo -e "${BLUE}=== Agrolytix Docker Manager ===${NC}"
    echo ""
    echo "Comandos disponíveis:"
    echo ""
    echo -e "${GREEN}setup${NC}        - Configuração inicial completa"
    echo -e "${GREEN}start${NC}        - Iniciar todos os serviços"
    echo -e "${GREEN}stop${NC}         - Parar todos os serviços"
    echo -e "${GREEN}restart${NC}      - Reiniciar todos os serviços"
    echo -e "${GREEN}logs${NC}         - Visualizar logs dos serviços"
    echo -e "${GREEN}db-only${NC}      - Iniciar apenas o banco de dados"
    echo -e "${GREEN}backup${NC}       - Fazer backup do banco de dados"
    echo -e "${GREEN}restore${NC}      - Restaurar backup do banco"
    echo -e "${GREEN}clean${NC}        - Limpar containers e volumes"
    echo -e "${GREEN}status${NC}       - Status dos serviços"
    echo -e "${GREEN}shell${NC}        - Acessar shell do container da app"
    echo -e "${GREEN}db-shell${NC}     - Acessar shell do PostgreSQL"
    echo ""
}

# Função para verificar se Docker está rodando
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker não está rodando!${NC}"
        exit 1
    fi
}

# Função para configuração inicial
setup() {
    echo -e "${BLUE}🚀 Configurando ambiente Agrolytix...${NC}"
    
    # Criar diretórios necessários
    mkdir -p database/init
    mkdir -p database/backups
    mkdir -p logs
    
    # Copiar arquivo de ambiente se não existir
    if [ ! -f .env ]; then
        if [ -f env.example ]; then
            cp env.example .env
            echo -e "${GREEN}✅ Arquivo .env criado a partir do env.example${NC}"
        else
            echo -e "${YELLOW}⚠️  Arquivo env.example não encontrado${NC}"
        fi
    fi
    
    # Build das imagens
    echo -e "${BLUE}🔨 Fazendo build das imagens...${NC}"
    docker-compose build
    
    # Iniciar serviços
    echo -e "${BLUE}🚀 Iniciando serviços...${NC}"
    docker-compose up -d postgres redis
    
    # Aguardar banco ficar pronto
    echo -e "${BLUE}⏳ Aguardando banco de dados ficar pronto...${NC}"
    sleep 10
    
    echo -e "${GREEN}✅ Configuração inicial concluída!${NC}"
    echo -e "${BLUE}🌐 Acesse o Adminer em: http://localhost:8080${NC}"
    echo -e "${BLUE}📊 Dados de conexão:${NC}"
    echo "   Sistema: PostgreSQL"
    echo "   Servidor: postgres"
    echo "   Usuário: agrolytix_user"
    echo "   Senha: agrolytix_2024"
    echo "   Base: agrolytix_db"
}

# Função para iniciar serviços
start() {
    echo -e "${BLUE}🚀 Iniciando serviços Agrolytix...${NC}"
    docker-compose up -d
    echo -e "${GREEN}✅ Serviços iniciados!${NC}"
    status
}

# Função para parar serviços
stop() {
    echo -e "${YELLOW}🛑 Parando serviços Agrolytix...${NC}"
    docker-compose down
    echo -e "${GREEN}✅ Serviços parados!${NC}"
}

# Função para reiniciar serviços
restart() {
    echo -e "${BLUE}🔄 Reiniciando serviços Agrolytix...${NC}"
    docker-compose restart
    echo -e "${GREEN}✅ Serviços reiniciados!${NC}"
}

# Função para visualizar logs
logs() {
    echo -e "${BLUE}📋 Logs dos serviços:${NC}"
    docker-compose logs -f --tail=100
}

# Função para iniciar apenas banco
db_only() {
    echo -e "${BLUE}🗄️  Iniciando apenas banco de dados...${NC}"
    docker-compose up -d postgres adminer
    echo -e "${GREEN}✅ Banco de dados iniciado!${NC}"
    echo -e "${BLUE}🌐 Adminer disponível em: http://localhost:8080${NC}"
}

# Função para backup
backup() {
    echo -e "${BLUE}💾 Fazendo backup do banco de dados...${NC}"
    
    BACKUP_FILE="database/backups/agrolytix_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    docker-compose exec postgres pg_dump -U agrolytix_user -d agrolytix_db > "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Backup criado: $BACKUP_FILE${NC}"
    else
        echo -e "${RED}❌ Erro ao criar backup!${NC}"
        exit 1
    fi
}

# Função para restaurar backup
restore() {
    echo -e "${YELLOW}⚠️  Esta operação irá substituir todos os dados atuais!${NC}"
    read -p "Tem certeza? (s/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        echo "Digite o caminho do arquivo de backup:"
        read BACKUP_FILE
        
        if [ -f "$BACKUP_FILE" ]; then
            echo -e "${BLUE}🔄 Restaurando backup...${NC}"
            docker-compose exec -T postgres psql -U agrolytix_user -d agrolytix_db < "$BACKUP_FILE"
            echo -e "${GREEN}✅ Backup restaurado!${NC}"
        else
            echo -e "${RED}❌ Arquivo não encontrado: $BACKUP_FILE${NC}"
        fi
    else
        echo -e "${YELLOW}Operação cancelada.${NC}"
    fi
}

# Função para limpeza
clean() {
    echo -e "${YELLOW}⚠️  Esta operação irá remover todos os containers e volumes!${NC}"
    read -p "Tem certeza? (s/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        echo -e "${BLUE}🧹 Limpando ambiente...${NC}"
        docker-compose down -v --remove-orphans
        docker system prune -f
        echo -e "${GREEN}✅ Limpeza concluída!${NC}"
    else
        echo -e "${YELLOW}Operação cancelada.${NC}"
    fi
}

# Função para status
status() {
    echo -e "${BLUE}📊 Status dos serviços:${NC}"
    docker-compose ps
}

# Função para shell da aplicação
shell() {
    echo -e "${BLUE}🐚 Acessando shell da aplicação...${NC}"
    docker-compose exec app sh
}

# Função para shell do banco
db_shell() {
    echo -e "${BLUE}🗄️  Acessando shell do PostgreSQL...${NC}"
    docker-compose exec postgres psql -U agrolytix_user -d agrolytix_db
}

# Verificar Docker
check_docker

# Processar comando
case "${1:-help}" in
    setup)
        setup
        ;;
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    logs)
        logs
        ;;
    db-only)
        db_only
        ;;
    backup)
        backup
        ;;
    restore)
        restore
        ;;
    clean)
        clean
        ;;
    status)
        status
        ;;
    shell)
        shell
        ;;
    db-shell)
        db_shell
        ;;
    help|*)
        show_help
        ;;
esac 