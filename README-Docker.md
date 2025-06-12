# 🐳 Agrolytix - Ambiente Docker

Este documento explica como configurar e usar o ambiente Docker do projeto Agrolytix.

## 📋 Pré-requisitos

- **Docker** (versão 20.10+)
- **Docker Compose** (versão 2.0+)
- **Git** para clonar o repositório

## 🚀 Configuração Inicial

### 1. Clonar o repositório
```bash
git clone <url-do-repositorio>
cd agrolytix-backend
```

### 2. Configurar ambiente
```bash
# Dar permissão de execução ao script
chmod +x scripts/docker-manager.sh

# Executar configuração inicial
./scripts/docker-manager.sh setup
```

### 3. Configurar variáveis de ambiente
```bash
# Copiar arquivo de exemplo (se não foi feito automaticamente)
cp env.example .env

# Editar conforme necessário
nano .env
```

## 🛠️ Comandos Disponíveis

### Script de Gerenciamento
O projeto inclui um script que facilita o gerenciamento do ambiente Docker:

```bash
./scripts/docker-manager.sh [comando]
```

### Comandos Principais

| Comando | Descrição |
|---------|-----------|
| `setup` | Configuração inicial completa |
| `start` | Iniciar todos os serviços |
| `stop` | Parar todos os serviços |
| `restart` | Reiniciar todos os serviços |
| `logs` | Visualizar logs dos serviços |
| `status` | Status dos serviços |

### Comandos de Banco de Dados

| Comando | Descrição |
|---------|-----------|
| `db-only` | Iniciar apenas banco + Adminer |
| `backup` | Fazer backup do banco |
| `restore` | Restaurar backup |
| `db-shell` | Acessar shell do PostgreSQL |

### Comandos de Manutenção

| Comando | Descrição |
|---------|-----------|
| `shell` | Acessar shell da aplicação |
| `clean` | Limpar containers e volumes |

## 🏗️ Arquitetura dos Serviços

### PostgreSQL (Banco Principal)
- **Porta**: 5432
- **Usuário**: agrolytix_user
- **Senha**: agrolytix_2024
- **Database**: agrolytix_db
- **Volume**: Dados persistentes em `postgres_data`

### Adminer (Interface Web)
- **Porta**: 8080
- **URL**: http://localhost:8080
- **Tema**: pepa-linha-dark

### Redis (Cache/Sessões)
- **Porta**: 6379
- **Senha**: agrolytix_redis_2024
- **Volume**: Dados persistentes em `redis_data`

### Aplicação Node.js
- **Porta**: 3000
- **URL**: http://localhost:3000
- **Modo**: Desenvolvimento com hot-reload

## 📊 Monitoramento

### Verificar Status
```bash
./scripts/docker-manager.sh status
```

### Visualizar Logs
```bash
# Todos os serviços
./scripts/docker-manager.sh logs

# Serviço específico
docker-compose logs -f postgres
docker-compose logs -f app
```

### Recursos do Sistema
```bash
# Uso de recursos
docker stats

# Espaço em disco
docker system df
```

## 🗄️ Gerenciamento do Banco

### Acessar Adminer
1. Abrir http://localhost:8080
2. Configurar conexão:
   - **Sistema**: PostgreSQL
   - **Servidor**: postgres
   - **Usuário**: agrolytix_user
   - **Senha**: agrolytix_2024
   - **Base de dados**: agrolytix_db

### Backup Manual
```bash
# Backup automático
./scripts/docker-manager.sh backup

# Backup manual
docker-compose exec postgres pg_dump -U agrolytix_user agrolytix_db > backup.sql
```

### Restaurar Backup
```bash
# Via script (interativo)
./scripts/docker-manager.sh restore

# Manual
docker-compose exec -T postgres psql -U agrolytix_user -d agrolytix_db < backup.sql
```

## 🔧 Desenvolvimento

### Hot Reload
A aplicação está configurada com **nodemon** para reiniciar automaticamente quando arquivos são modificados.

### Acessar Shell da Aplicação
```bash
./scripts/docker-manager.sh shell
```

### Instalar Dependências
```bash
# Dentro do container
docker-compose exec app npm install nova-dependencia

# Ou rebuildar a imagem
docker-compose build app
```

## 🚨 Solução de Problemas

### Banco não conecta
```bash
# Verificar se está rodando
docker-compose ps

# Verificar logs
docker-compose logs postgres

# Reiniciar serviço
docker-compose restart postgres
```

### Porta já em uso
```bash
# Verificar processos na porta
lsof -i :5432
lsof -i :3000

# Alterar porta no docker-compose.yml se necessário
```

### Limpar ambiente
```bash
# Limpar tudo (CUIDADO: remove dados!)
./scripts/docker-manager.sh clean

# Limpar apenas containers
docker-compose down
```

### Problemas de permissão
```bash
# Dar permissão ao script
chmod +x scripts/docker-manager.sh

# Verificar propriedade dos arquivos
ls -la
```

## 📁 Estrutura de Arquivos

```
agrolytix-backend/
├── docker-compose.yml          # Configuração dos serviços
├── Dockerfile.dev              # Imagem para desenvolvimento
├── env.example                 # Exemplo de variáveis de ambiente
├── scripts/
│   └── docker-manager.sh       # Script de gerenciamento
├── database/
│   ├── init/                   # Scripts de inicialização
│   └── backups/                # Backups do banco
└── logs/                       # Logs da aplicação
```

## 🔒 Segurança

### Produção
Para ambiente de produção, altere:
- Senhas padrão
- Secrets do JWT
- Configurações de rede
- Volumes de dados

### Backup
- Backups automáticos configurados
- Retenção de 30 dias por padrão
- Armazenamento em `database/backups/`

## 📞 Suporte

Em caso de problemas:
1. Verificar logs: `./scripts/docker-manager.sh logs`
2. Verificar status: `./scripts/docker-manager.sh status`
3. Consultar documentação do Docker
4. Abrir issue no repositório

---

**Desenvolvido para o projeto Agrolytix** 🌱 