# 🚀 Guia Postman - API Agrolytix

Este guia te ajudará a testar todas as funcionalidades da API Agrolytix usando o Postman.

## 📋 Pré-requisitos

1. **Postman** instalado ([Download aqui](https://www.postman.com/downloads/))
2. **Aplicação rodando** em `http://localhost:3000`
3. **Banco de dados** configurado com dados iniciais

## 🔧 Configuração Inicial

### 1. Importar Collection e Environment

#### **Importar Collection:**
1. Abrir Postman
2. Clicar em **"Import"**
3. Selecionar o arquivo: `postman/Agrolytix-API.postman_collection.json`
4. Clicar em **"Import"**

#### **Importar Environment:**
1. Clicar em **"Import"**
2. Selecionar o arquivo: `postman/Agrolytix-Environment.postman_environment.json`
3. Clicar em **"Import"**
4. Selecionar o environment **"Agrolytix - Development"** no canto superior direito

### 2. Verificar Configurações

Certifique-se de que as variáveis estão configuradas:
- `base_url`: `http://localhost:3000`
- `jwt_token`: (será preenchido automaticamente após login)

## 🧪 Sequência de Testes Recomendada

### **Passo 1: Verificar Status da API**

#### **1.1 Status da API**
```
GET {{base_url}}/
```
**Resultado esperado:** Status 200 com informações da API

#### **1.2 Health Check**
```
GET {{base_url}}/api/saude
```
**Resultado esperado:** Status 200 com informações de saúde dos serviços

### **Passo 2: Autenticação**

#### **2.1 Login (IMPORTANTE - Fazer primeiro!)**
```
POST {{base_url}}/api/auth/login
Body:
{
    "email": "admin@agrolytix.com",
    "senha": "admin123"
}
```

**⚠️ IMPORTANTE:** Este request tem um script que salva automaticamente o token JWT na variável `jwt_token`. Sempre execute este request primeiro!

#### **2.2 Verificar Token**
```
GET {{base_url}}/api/auth/verificar
```
**Resultado esperado:** Confirmação de que o token é válido

### **Passo 3: Testar Endpoints Básicos**

#### **3.1 Listar Categorias**
```
GET {{base_url}}/api/categorias
```

#### **3.2 Listar Tipos**
```
GET {{base_url}}/api/tipos
```

#### **3.3 Listar Fornecedores**
```
GET {{base_url}}/api/fornecedores
```

### **Passo 4: Gerenciar Produtos**

#### **4.1 Listar Produtos**
```
GET {{base_url}}/api/produtos?page=1&limit=10&status=ativo
```

#### **4.2 Criar Produto**
```
POST {{base_url}}/api/produtos
Body:
{
    "fazenda_id": 1,
    "tipo_id": 1,
    "codigo_interno": "PROD001",
    "nome": "Fertilizante NPK",
    "descricao": "Fertilizante NPK 10-10-10 para cultivo geral",
    "marca": "AgroFert",
    "modelo": "NPK-1010",
    "valor_aquisicao": 150.00,
    "categoria_produto": "insumo",
    "status": "ativo",
    "observacoes": "Produto para teste"
}
```

#### **4.3 Buscar Produto por ID**
```
GET {{base_url}}/api/produtos/1
```

#### **4.4 Atualizar Produto**
```
PUT {{base_url}}/api/produtos/1
Body:
{
    "nome": "Fertilizante NPK Atualizado",
    "valor_aquisicao": 160.00,
    "observacoes": "Produto atualizado via API"
}
```

### **Passo 5: Movimentações de Estoque**

#### **5.1 Criar Movimentação**
```
POST {{base_url}}/api/movimentacoes
Body:
{
    "fazenda_id": 1,
    "tipo_movimentacao_id": 1,
    "numero_documento": "MOV001",
    "data_movimentacao": "2024-01-15",
    "descricao": "Entrada de fertilizantes",
    "observacoes": "Compra para safra 2024",
    "itens": [
        {
            "produto_id": 1,
            "quantidade": 100,
            "valor_unitario": 150.00,
            "observacoes": "Lote A001"
        }
    ]
}
```

#### **5.2 Listar Movimentações**
```
GET {{base_url}}/api/movimentacoes?page=1&limit=10
```

## 🔐 Autenticação Automática

A collection está configurada para usar **Bearer Token** automaticamente. O token é salvo quando você faz login e usado em todas as requests subsequentes.

### **Como funciona:**
1. Faça login usando o request **"Login"**
2. O script automático salva o token na variável `jwt_token`
3. Todas as outras requests usam este token automaticamente

### **Se o token expirar:**
- Execute novamente o request **"Login"**
- O novo token será salvo automaticamente

## 📊 Códigos de Status Esperados

| Status | Significado | Quando ocorre |
|--------|-------------|---------------|
| **200** | ✅ Sucesso | Request executado com sucesso |
| **201** | ✅ Criado | Recurso criado com sucesso |
| **400** | ❌ Bad Request | Dados inválidos ou faltando |
| **401** | ❌ Não autorizado | Token inválido ou expirado |
| **403** | ❌ Proibido | Sem permissão para a ação |
| **404** | ❌ Não encontrado | Recurso não existe |
| **500** | ❌ Erro interno | Erro no servidor |

## 🧪 Exemplos de Dados para Teste

### **Usuário Admin (para login):**
```json
{
    "email": "admin@agrolytix.com",
    "senha": "admin123"
}
```

### **Novo Usuário:**
```json
{
    "nome": "João Silva",
    "email": "joao@agrolytix.com",
    "senha": "senha123",
    "cpf": "12345678901",
    "telefone": "(11) 99999-9999",
    "cargo": "Operador",
    "empresa_id": 1
}
```

### **Nova Categoria:**
```json
{
    "nome": "Fertilizantes",
    "descricao": "Categoria para fertilizantes e adubos",
    "cor": "#4CAF50"
}
```

### **Novo Tipo:**
```json
{
    "categoria_id": 1,
    "nome": "NPK",
    "descricao": "Fertilizante NPK",
    "unidade_medida": "kg",
    "estoque_minimo": 50
}
```

### **Novo Fornecedor:**
```json
{
    "nome": "AgroFert Ltda",
    "cnpj": "12.345.678/0001-90",
    "email": "contato@agrofert.com",
    "telefone": "(11) 3333-4444",
    "endereco": "Rua dos Fertilizantes, 123",
    "cidade": "São Paulo",
    "estado": "SP",
    "cep": "01234-567"
}
```

## 🚨 Solução de Problemas

### **Erro 401 - Token inválido:**
1. Execute novamente o request **"Login"**
2. Verifique se o environment está selecionado
3. Confirme que a variável `jwt_token` foi preenchida

### **Erro 500 - Erro interno:**
1. Verifique se a aplicação está rodando
2. Verifique se o banco de dados está conectado
3. Consulte os logs: `docker-compose logs app`

### **Erro 404 - Rota não encontrada:**
1. Verifique se a URL está correta
2. Confirme que a aplicação está na versão mais recente

### **Dados não aparecem:**
1. Verifique se o banco tem dados iniciais
2. Execute requests de criação primeiro
3. Confirme permissões do usuário

## 📝 Dicas Importantes

### **1. Ordem dos Testes:**
1. ✅ Status da API
2. ✅ Login (OBRIGATÓRIO)
3. ✅ Criar dados básicos (categorias, tipos, fornecedores)
4. ✅ Gerenciar produtos
5. ✅ Movimentações

### **2. Variáveis Úteis:**
- `{{base_url}}` - URL base da API
- `{{jwt_token}}` - Token de autenticação
- `{{empresa_id}}` - ID da empresa (padrão: 1)
- `{{fazenda_id}}` - ID da fazenda (padrão: 1)

### **3. Scripts Automáticos:**
- Login salva token automaticamente
- Responses são formatados em JSON
- Erros são destacados claramente

## 🎯 Próximos Passos

Após testar a API:
1. **Implementar frontend** usando os endpoints testados
2. **Configurar CI/CD** com testes automatizados
3. **Documentar** endpoints adicionais
4. **Implementar** funcionalidades avançadas

---

**Happy Testing! 🚀🌱** 