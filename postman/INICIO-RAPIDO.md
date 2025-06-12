# 🚀 INÍCIO RÁPIDO - Testando API Agrolytix no Postman

## ✅ Status da API
- **✅ API funcionando**: http://localhost:3000
- **✅ Banco conectado**: PostgreSQL
- **✅ Autenticação**: JWT funcionando
- **✅ Endpoints**: Operacionais

## 🔧 Configuração Rápida

### **Opção 1: Importar Collection Completa (RECOMENDADO)**

1. **Abrir Postman**
2. **Clicar em "Import"**
3. **Importar arquivos:**
   - `postman/Agrolytix-API.postman_collection.json`
   - `postman/Agrolytix-Environment.postman_environment.json`
4. **Selecionar environment**: "Agrolytix - Development"
5. **Pronto!** Todos os requests configurados

### **Opção 2: Requests Manuais**

Copie e cole os requests do arquivo: `postman/Requests-Exemplos.md`

## 🎯 TESTE RÁPIDO - 3 Passos

### **1. Status da API**
```
GET http://localhost:3000/
```
**Resultado esperado:** Status 200 ✅

### **2. Login (OBRIGATÓRIO)**
```
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
    "identifier": "admin@agrolytix.com",
    "senha": "admin123"
}
```
**⚠️ IMPORTANTE:** Copie o `token` da resposta!

### **3. Testar Endpoint Protegido**
```
GET http://localhost:3000/api/categorias
Authorization: Bearer SEU_TOKEN_AQUI
```
**Resultado esperado:** Lista de categorias ✅

## 🔐 Credenciais de Teste

| Campo | Valor |
|-------|-------|
| **Email/Login** | `admin@agrolytix.com` |
| **Senha** | `admin123` |
| **Tipo** | Administrador |

## 📋 Endpoints Principais

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/` | Status da API |
| `GET` | `/api/saude` | Health check |
| `POST` | `/api/auth/login` | Login |
| `GET` | `/api/auth/verificar` | Verificar token |
| `GET` | `/api/categorias` | Listar categorias |
| `GET` | `/api/tipos` | Listar tipos |
| `GET` | `/api/fornecedores` | Listar fornecedores |
| `GET` | `/api/produtos` | Listar produtos |
| `POST` | `/api/produtos` | Criar produto |
| `GET` | `/api/movimentacoes` | Listar movimentações |

## 🚨 Solução de Problemas

### **❌ Erro 401 - Unauthorized**
- Fazer login novamente
- Copiar novo token
- Verificar header: `Authorization: Bearer TOKEN`

### **❌ Erro 500 - Internal Server Error**
- Verificar se aplicação está rodando: `docker-compose ps`
- Ver logs: `docker-compose logs app`

### **❌ API não responde**
- Iniciar containers: `docker-compose up -d`
- Verificar URL: `http://localhost:3000`

## 🎉 Pronto para Testar!

1. **✅ Importar collection no Postman**
2. **✅ Fazer login para obter token**
3. **✅ Testar endpoints**
4. **✅ Criar/editar dados**

---

**🌱 Happy Testing com Agrolytix!** 