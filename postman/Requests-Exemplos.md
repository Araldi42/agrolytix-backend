# 📋 Requests de Exemplo - Copiar e Colar no Postman

## 🚀 **PASSO A PASSO RÁPIDO**

### **1. Status da API**
```
GET http://localhost:3000/
```

### **2. Health Check**
```
GET http://localhost:3000/api/saude
```

### **3. Login (FAZER PRIMEIRO!)**
```
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
    "identifier": "admin@agrolytix.com",
    "senha": "admin123"
}
```
**⚠️ Copie o token da resposta e use nos próximos requests!**

### **4. Verificar Token**
```
GET http://localhost:3000/api/auth/verificar
Authorization: Bearer SEU_TOKEN_AQUI
```

### **5. Listar Categorias**
```
GET http://localhost:3000/api/categorias
Authorization: Bearer SEU_TOKEN_AQUI
```

### **6. Criar Categoria**
```
POST http://localhost:3000/api/categorias
Authorization: Bearer SEU_TOKEN_AQUI
Content-Type: application/json

{
    "nome": "Fertilizantes",
    "descricao": "Categoria para fertilizantes e adubos",
    "cor": "#4CAF50"
}
```

### **7. Listar Tipos**
```
GET http://localhost:3000/api/tipos
Authorization: Bearer SEU_TOKEN_AQUI
```

### **8. Criar Tipo**
```
POST http://localhost:3000/api/tipos
Authorization: Bearer SEU_TOKEN_AQUI
Content-Type: application/json

{
    "categoria_id": 1,
    "nome": "NPK",
    "descricao": "Fertilizante NPK",
    "unidade_medida": "kg",
    "estoque_minimo": 50
}
```

### **9. Listar Fornecedores**
```
GET http://localhost:3000/api/fornecedores
Authorization: Bearer SEU_TOKEN_AQUI
```

### **10. Criar Fornecedor**
```
POST http://localhost:3000/api/fornecedores
Authorization: Bearer SEU_TOKEN_AQUI
Content-Type: application/json

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

### **11. Listar Produtos**
```
GET http://localhost:3000/api/produtos?page=1&limit=10&status=ativo
Authorization: Bearer SEU_TOKEN_AQUI
```

### **12. Criar Produto**
```
POST http://localhost:3000/api/produtos
Authorization: Bearer SEU_TOKEN_AQUI
Content-Type: application/json

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

### **13. Buscar Produto por ID**
```
GET http://localhost:3000/api/produtos/1
Authorization: Bearer SEU_TOKEN_AQUI
```

### **14. Atualizar Produto**
```
PUT http://localhost:3000/api/produtos/1
Authorization: Bearer SEU_TOKEN_AQUI
Content-Type: application/json

{
    "nome": "Fertilizante NPK Atualizado",
    "valor_aquisicao": 160.00,
    "observacoes": "Produto atualizado via API"
}
```

### **15. Listar Movimentações**
```
GET http://localhost:3000/api/movimentacoes?page=1&limit=10
Authorization: Bearer SEU_TOKEN_AQUI
```

### **16. Criar Movimentação**
```
POST http://localhost:3000/api/movimentacoes
Authorization: Bearer SEU_TOKEN_AQUI
Content-Type: application/json

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

## 🔧 **CONFIGURAÇÃO RÁPIDA NO POSTMAN**

### **Método 1: Requests Individuais**
1. Abrir Postman
2. Criar nova request
3. Copiar e colar URL e método
4. Adicionar headers se necessário
5. Adicionar body se for POST/PUT
6. Enviar request

### **Método 2: Collection Completa**
1. Baixar arquivos da pasta `postman/`
2. Importar no Postman:
   - `Agrolytix-API.postman_collection.json`
   - `Agrolytix-Environment.postman_environment.json`
3. Selecionar environment "Agrolytix - Development"
4. Executar requests na ordem

## 📝 **DICAS IMPORTANTES**

### **Headers Necessários:**
```
Authorization: Bearer SEU_TOKEN_JWT
Content-Type: application/json
```

### **Substituir Token:**
- Após fazer login, copie o token da resposta
- Substitua `SEU_TOKEN_AQUI` pelo token real
- Token expira em 24h (configurável)

### **URLs Base:**
- **Desenvolvimento**: `http://localhost:3000`
- **Produção**: Alterar conforme deploy

### **Códigos de Resposta:**
- **200**: ✅ Sucesso
- **201**: ✅ Criado
- **400**: ❌ Dados inválidos
- **401**: ❌ Não autorizado
- **403**: ❌ Sem permissão
- **404**: ❌ Não encontrado
- **500**: ❌ Erro interno

## 🚨 **SOLUÇÃO DE PROBLEMAS**

### **Erro 401 - Unauthorized:**
1. Fazer login novamente
2. Copiar novo token
3. Atualizar header Authorization

### **Erro 500 - Internal Server Error:**
1. Verificar se aplicação está rodando
2. Verificar logs: `docker-compose logs app`
3. Verificar conexão com banco

### **Erro 404 - Not Found:**
1. Verificar URL
2. Verificar se rota existe
3. Verificar método HTTP (GET, POST, PUT, DELETE)

### **Dados não aparecem:**
1. Verificar se banco tem dados
2. Criar dados básicos primeiro (categorias, tipos, fornecedores)
3. Verificar permissões do usuário

---

**Pronto para testar! 🚀🌱** 