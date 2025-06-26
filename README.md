# 🌾 Agrolytix Backend - Sistema de Gestão Agrícola

API backend completa para gestão agrícola com controle de estoque, movimentações, safras e muito mais.

## 🚀 Início Rápido

### Pré-requisitos
- Docker e Docker Compose
- Node.js 18+ (para desenvolvimento local)

### Setup Completo
```bash
# Windows
.\scripts\setup-database.ps1

# Ou manualmente
docker-compose down -v
docker-compose up -d
```

### Credenciais de Acesso
- **API**: http://localhost:3000
- **Admin**: admin@agrolytix.com / admin123
- **Adminer**: http://localhost:8080 (PostgreSQL UI)

## 🏗️ Arquitetura

### Tecnologias
- **Backend**: Node.js + Express
- **Banco**: PostgreSQL 15
- **Cache**: Redis 7
- **Container**: Docker

### Estrutura do Banco
- ✅ **Empresas e Fazendas**: Estrutura organizacional
- ✅ **Usuários e Permissões**: Sistema completo de autenticação
- ✅ **Produtos e Estoque**: Controle detalhado de insumos e ativos
- ✅ **Movimentações**: Entradas, saídas e transferências automáticas
- ✅ **Safras**: Gestão de ciclos produtivos
- ✅ **Auditoria**: Log completo de todas as operações

## 🔧 Desenvolvimento

### Estrutura de Pastas
```
src/
├── controllers/    # Controladores da API
├── models/        # Modelos de dados
├── routes/        # Rotas da API
├── middlewares/   # Middlewares (auth, validação)
├── services/      # Serviços (JWT, validação)
└── config/        # Configurações

database/
├── init/          # Scripts de criação (DDL)
└── seeds/         # Dados iniciais
```

### Scripts Úteis
```bash
# Recriar banco completo
.\scripts\setup-database.ps1

# Ver logs
docker-compose logs -f app

# Acessar banco diretamente
docker exec -it agrolytix-postgres psql -U agrolytix_user -d agrolytix_db
```

## 📊 Funcionalidades

### Sistema Completo SaaS
- **Multi-empresa**: Cada empresa com suas fazendas
- **Controle granular**: Produtos, lotes, setores
- **Movimentações automáticas**: Estoque atualizado automaticamente
- **Rastreabilidade completa**: Histórico de todas as operações
- **Gestão de safras**: Controle de custos e produtividade

### API Endpoints
- `POST /api/auth/login` - Login
- `GET /api/usuarios` - Usuários
- `GET /api/produtos` - Produtos
- `GET /api/estoque` - Estoque atual
- `POST /api/movimentacoes` - Criar movimentação
- E muito mais...

## 🔐 Segurança

- JWT para autenticação
- Bcrypt para senhas
- Validação completa de dados
- Sistema de permissões por perfil
- Auditoria de todas as operações

## 📝 Exemplos de Uso

### Dados Pré-carregados
O sistema vem com dados de exemplo da **Fazenda Santa Maria**:
- 8 produtos cadastrados (herbicidas, fertilizantes, equipamentos)
- Estoque inicial distribuído em diferentes setores
- Movimentações de exemplo
- 3 safras em andamento
- Histórico de manutenções

### Teste de Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@agrolytix.com","senha":"admin123"}'
```

## 📞 Suporte

- **Documentação**: Código auto-documentado
- **Postman**: Collection disponível em `/postman/`
- **Logs**: `docker-compose logs -f` 