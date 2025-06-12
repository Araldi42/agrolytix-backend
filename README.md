# 🌱 Agrolytix Backend

Sistema de gestão agrícola moderno e escalável desenvolvido em Node.js com arquitetura multi-tenant.

## 📋 Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Tecnologias](#tecnologias)
- [Pré-requisitos](#pré-requisitos)
- [Instalação e Configuração](#instalação-e-configuração)
- [Executando o Projeto](#executando-o-projeto)
- [Validação e Testes](#validação-e-testes)
- [Testando com Postman](#testando-com-postman)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Scripts Disponíveis](#scripts-disponíveis)
- [Troubleshooting](#troubleshooting)

## 🎯 Sobre o Projeto

O Agrolytix é uma API REST para gestão agrícola que oferece:

- **🏢 Multi-tenant**: Suporte a múltiplas empresas/fazendas
- **📦 Gestão de Produtos**: Controle completo de insumos e equipamentos
- **📊 Movimentações**: Controle de estoque com entrada/saída automática
- **👥 Usuários e Permissões**: Sistema robusto de autenticação e autorização
- **🔐 Segurança**: JWT, bcrypt, validações e sanitização
- **🐳 Docker**: Ambiente completo containerizado

## 🛠 Tecnologias

- **Backend**: Node.js + Express.js
- **Banco de Dados**: PostgreSQL 15
- **Cache**: Redis 7
- **Autenticação**: JWT (JSON Web Tokens)
- **Containerização**: Docker + Docker Compose
- **ORM**: SQL nativo com pool de conexões
- **Documentação**: Postman Collections

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop/))
- **Git** ([Download](https://git-scm.com/downloads))
- **Node.js 18+** (opcional, para scripts locais)
- **Postman** (opcional, para testes da API)

### Verificar Instalações

```bash
# Verificar Docker
docker --version
docker-compose --version

# Verificar Git
git --version

# Verificar Node.js (opcional)
node --version
npm --version
```

## ⚡ Início Rápido (1 Comando)

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/agrolytix-backend.git
cd agrolytix-backend

# Execute o setup completo (Windows PowerShell)
.\scripts\setup-completo.ps1
```

**Pronto!** Em alguns minutos você terá:
- ✅ API funcionando em http://localhost:3000
- ✅ Banco PostgreSQL configurado
- ✅ Usuário admin criado
- ✅ Todos os endpoints testados e validados

## 🚀 Instalação e Configuração

### 1. Clonar o Repositório

```bash
git clone https://github.com/seu-usuario/agrolytix-backend.git
cd agrolytix-backend
```

### 2. Configurar Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
cp env.example .env

# Editar variáveis (opcional - valores padrão funcionam)
# As configurações padrão já estão otimizadas para desenvolvimento
```

### 3. Instalar Dependências (Opcional)

```bash
# Apenas se quiser rodar scripts locais
npm install
```

## 🐳 Executando o Projeto

### Opção 1: Setup Completo Automatizado (RECOMENDADO)

```bash
# Windows PowerShell - Setup completo com validação
.\scripts\setup-completo.ps1

# Ou usando docker-manager
.\scripts\docker-manager.ps1 setup

# Linux/Mac
./scripts/docker-manager.sh setup
```

### Opção 2: Passo a Passo Manual

```bash
# 1. Construir imagens Docker
docker-compose build

# 2. Iniciar todos os serviços
docker-compose up -d

# 3. Verificar se todos os containers estão rodando
docker-compose ps

# 4. Configurar usuário admin
.\scripts\setup-admin.ps1  # Windows
# ou
./scripts/setup-admin.sh   # Linux/Mac (se disponível)
```

### 🔍 Verificar Status dos Serviços

```bash
docker-compose ps
```

**Resultado esperado:**
```
NAME                STATUS              PORTS
agrolytix-app       Up                  0.0.0.0:3000->3000/tcp
agrolytix-postgres  Up (healthy)        0.0.0.0:5432->5432/tcp
agrolytix-redis     Up                  0.0.0.0:6379->6379/tcp
agrolytix-adminer   Up                  0.0.0.0:8080->8080/tcp
```

## ✅ Validação e Testes

### 1. Teste Automatizado Completo

```bash
# Windows PowerShell
.\scripts\test-api.ps1

# Resultado esperado:
# ✅ API Status: OK
# ✅ Health Check: OK  
# ✅ Autenticação: OK
# ✅ Endpoints: Funcionando
```

### 2. Testes Manuais Rápidos

```bash
# 1. Status da API
curl http://localhost:3000/

# 2. Health Check
curl http://localhost:3000/api/saude

# 3. Login (PowerShell)
Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body '{"identifier":"admin@agrolytix.com","senha":"admin123"}'
```

### 3. Acessar Interfaces Web

- **API**: http://localhost:3000
- **Adminer (DB)**: http://localhost:8080
  - **Servidor**: postgres
  - **Usuário**: agrolytix_user
  - **Senha**: agrolytix_2024
  - **Base de dados**: agrolytix_db

## 📮 Testando com Postman

### Opção 1: Collection Completa (RECOMENDADO)

1. **Abrir Postman**
2. **Importar arquivos:**
   - `postman/Agrolytix-API.postman_collection.json`
   - `postman/Agrolytix-Environment.postman_environment.json`
3. **Selecionar environment**: "Agrolytix - Development"
4. **Executar request "Login"** primeiro
5. **Testar outros endpoints**

### Opção 2: Guias Rápidos

- **📖 Início Rápido**: `postman/INICIO-RAPIDO.md`
- **📋 Requests Manuais**: `postman/Requests-Exemplos.md`
- **📚 Documentação Completa**: `postman/README-Postman.md`

### 🔐 Credenciais de Teste

| Campo | Valor |
|-------|-------|
| **Email/Login** | `admin@agrolytix.com` |
| **Senha** | `admin123` |
| **Tipo** | Administrador |

## 📁 Estrutura do Projeto

```
agrolytix-backend/
├── 📁 src/                     # Código fonte
│   ├── 📁 config/              # Configurações (DB, JWT, etc.)
│   ├── 📁 controllers/         # Controllers da API
│   ├── 📁 middlewares/         # Middlewares (auth, errors, etc.)
│   ├── 📁 models/              # Models e DTOs
│   ├── 📁 routes/              # Rotas da API
│   ├── 📁 services/            # Serviços (JWT, validações)
│   └── 📄 server.js            # Servidor principal
├── 📁 database/                # Scripts de banco
│   ├── 📁 init/                # Inicialização
│   └── 📁 seeds/               # Dados iniciais
├── 📁 postman/                 # Collections e documentação
├── 📁 scripts/                 # Scripts utilitários
├── 📄 docker-compose.yml       # Orquestração Docker
├── 📄 Dockerfile.dev           # Imagem Docker
├── 📄 package.json             # Dependências Node.js
└── 📄 README.md                # Este arquivo
```

## 🔧 Scripts Disponíveis

### Scripts Docker

```bash
# Windows PowerShell
.\scripts\docker-manager.ps1 [comando]

# Comandos disponíveis:
setup     # Setup completo do projeto
start     # Iniciar todos os serviços
stop      # Parar todos os serviços
restart   # Reiniciar serviços
logs      # Ver logs da aplicação
status    # Status dos containers
clean     # Limpeza completa
backup    # Backup do banco
restore   # Restaurar backup
```

### Scripts de Setup e Teste

```bash
# Setup completo automatizado (RECOMENDADO)
.\scripts\setup-completo.ps1

# Setup completo sem validação
.\scripts\setup-completo.ps1 -SkipValidation

# Teste completo da API
.\scripts\test-api.ps1

# Configurar usuário admin
.\scripts\setup-admin.ps1

# Gerar hash de senha
node scripts/generate-hash.js
```

### Scripts NPM

```bash
# Desenvolvimento local (sem Docker)
npm run dev

# Produção local
npm start

# Scripts Docker
npm run docker:setup
npm run docker:start
npm run docker:stop
npm run docker:logs
```

## 🚨 Troubleshooting

### Problemas Comuns

#### ❌ Containers não iniciam

```bash
# Verificar logs
docker-compose logs

# Recriar containers
docker-compose down
docker-compose up -d --force-recreate
```

#### ❌ Erro de conexão com banco

```bash
# Verificar se PostgreSQL está rodando
docker-compose ps postgres

# Reiniciar apenas o banco
docker-compose restart postgres
```

#### ❌ API retorna erro 500

```bash
# Ver logs da aplicação
docker-compose logs app

# Reiniciar aplicação
docker-compose restart app
```

#### ❌ Erro de autenticação

```bash
# Reconfigurar usuário admin
.\scripts\setup-admin.ps1

# Verificar credenciais no banco
docker-compose exec postgres psql -U agrolytix_user -d agrolytix_db -c "SELECT id, nome, email FROM usuarios;"
```

#### ❌ Porta já em uso

```bash
# Verificar processos usando as portas
netstat -ano | findstr :3000
netstat -ano | findstr :5432

# Parar containers e tentar novamente
docker-compose down
docker-compose up -d
```

### Comandos Úteis

```bash
# Logs em tempo real
docker-compose logs -f app

# Acessar container da aplicação
docker-compose exec app sh

# Acessar PostgreSQL
docker-compose exec postgres psql -U agrolytix_user -d agrolytix_db

# Limpar tudo e recomeçar
docker-compose down -v
docker system prune -f
.\scripts\docker-manager.ps1 setup
```

## 📊 Status dos Endpoints

Após executar `.\scripts\test-api.ps1`, você deve ver:

- ✅ **API Status**: OK
- ✅ **Health Check**: OK  
- ✅ **Autenticação**: OK
- ✅ **Categorias**: 8 encontradas
- ✅ **Tipos**: 20 encontrados
- ✅ **Fornecedores**: 5 encontrados
- ✅ **Produtos**: Funcionando
- ✅ **Movimentações**: Funcionando

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 📞 Suporte

- **Documentação**: Verifique os arquivos na pasta `postman/`
- **Issues**: Abra uma issue no GitHub
- **Email**: contato@agrolytix.com

---

**🌱 Desenvolvido com ❤️ para o agronegócio brasileiro** 