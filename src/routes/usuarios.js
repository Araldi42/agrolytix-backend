// ===================================================================
// ROUTES: usuarios.js
// ===================================================================
const express = require('express');
const router = express.Router();
const GerenciaUsuariosController = require('../controllers/GerenciaUsuarioController');
const { autenticacao, requerNivel } = require('../middlewares/authorizationMiddleware');

// ===================================================================
// MIDDLEWARES APLICADOS A TODAS AS ROTAS
// ===================================================================

// Todas as rotas de usuários requerem autenticação
router.use(autenticacao);

// ===================================================================
// ROTAS AUXILIARES (Para formulários do frontend)
// ===================================================================

/**
 * GET /api/usuarios/perfis
 * Lista perfis disponíveis para seleção no frontend
 * Acesso: Administradores e Gerentes (níveis 2 e 3)
 */
router.get('/perfis', requerNivel(3), GerenciaUsuariosController.listarPerfis);

/**
 * GET /api/usuarios/fazendas
 * Lista fazendas da empresa para seleção no frontend
 * Acesso: Administradores e Gerentes (níveis 2 e 3)
 */
router.get('/fazendas', requerNivel(3), GerenciaUsuariosController.listarFazendas);

// ===================================================================
// ROTAS PRINCIPAIS DE USUÁRIOS
// ===================================================================

/**
 * GET /api/usuarios
 * Lista usuários com filtros e paginação
 * 
 * Query Parameters:
 * - pagina: número da página (default: 1)
 * - limite: itens por página (default: 10, max: 50)
 * - perfil_id: filtrar por perfil
 * - fazenda_id: filtrar por fazenda
 * - ativo: filtrar por status (true/false)
 * - busca: busca por nome, email, login ou cargo
 * 
 * Acesso: Administradores e Gerentes (níveis 2 e 3)
 */
router.get('/', requerNivel(3), GerenciaUsuariosController.listar);

/**
 * GET /api/usuarios/:id
 * Busca usuário específico por ID
 * 
 * Params:
 * - id: ID do usuário
 * 
 * Acesso: Administradores e Gerentes (níveis 2 e 3)
 */
router.get('/:id', requerNivel(3), GerenciaUsuariosController.buscarPorId);

/**
 * POST /api/usuarios
 * Cria novo usuário
 * 
 * Body (JSON):
 * {
 *   "perfil_id": 4,
 *   "nome": "João da Silva",
 *   "login": "joao.silva",
 *   "email": "joao@empresa.com",
 *   "senha": "senha123",
 *   "cpf": "123.456.789-00", // opcional
 *   "telefone": "(11) 99999-9999", // opcional
 *   "cargo": "Operador de Campo", // opcional
 *   "fazendas_acesso": [1, 2] // opcional - array de IDs das fazendas
 * }
 * 
 * Acesso: Administradores e Gerentes (níveis 2 e 3)
 */
router.post('/', requerNivel(3), GerenciaUsuariosController.criar);

/**
 * PUT /api/usuarios/:id
 * Atualiza usuário existente
 * 
 * Params:
 * - id: ID do usuário
 * 
 * Body (JSON) - todos os campos são opcionais:
 * {
 *   "perfil_id": 3,
 *   "nome": "João da Silva Santos",
 *   "login": "joao.santos",
 *   "email": "joao.santos@empresa.com",
 *   "senha": "novaSenha123", // opcional - só enviar se quiser alterar
 *   "cpf": "123.456.789-00",
 *   "telefone": "(11) 88888-8888",
 *   "cargo": "Gerente de Campo",
 *   "ativo": true,
 *   "fazendas_acesso": [1, 3] // array de IDs - substitui o acesso atual
 * }
 * 
 * Acesso: Administradores e Gerentes (níveis 2 e 3)
 */
router.put('/:id', requerNivel(3), GerenciaUsuariosController.atualizar);

/**
 * DELETE /api/usuarios/:id
 * Exclui usuário (soft delete - marca como inativo)
 * 
 * Params:
 * - id: ID do usuário
 * 
 * Obs: Não permite excluir o próprio usuário
 * 
 * Acesso: Administradores e Gerentes (níveis 2 e 3)
 */
router.delete('/:id', requerNivel(3), GerenciaUsuariosController.excluir);

// ===================================================================
// MIDDLEWARE DE TRATAMENTO DE ERROS ESPECÍFICO DAS ROTAS
// ===================================================================

// Middleware para capturar erros não tratados nas rotas de usuários
router.use((error, req, res, next) => {
    console.error('Erro nas rotas de usuários:', {
        error: error.message,
        stack: error.stack,
        url: req.originalUrl,
        method: req.method,
        body: req.body,
        usuario: req.usuario?.id
    });

    // Se o erro já foi tratado (response já enviado), apenas prossegue
    if (res.headersSent) {
        return next(error);
    }

    // Resposta padrão para erros não tratados
    res.status(500).json({
        sucesso: false,
        mensagem: 'Erro interno do servidor na gestão de usuários',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;

// ===================================================================
// DOCUMENTAÇÃO PARA O FRONTEND REACT/NEXT.JS
// ===================================================================

/*

ESTRUTURA DE DADOS PARA O FRONTEND:

1. USUÁRIO (objeto retornado pelas APIs):
{
  "id": 5,
  "empresa_id": 2,
  "perfil_id": 3,
  "nome": "Ana Paula Santos",
  "login": "ana.santos",
  "email": "ana@empresa.com",
  "cpf": "345.678.901-23",
  "telefone": "(89) 99234-5678",
  "cargo": "Gerente de Produção",
  "ultimo_acesso": "2024-12-20T10:30:00.000Z",
  "ativo": true,
  "criado_em": "2024-01-15T08:00:00.000Z",
  "atualizado_em": "2024-12-01T14:30:00.000Z",
  "perfil_nome": "Gerente",
  "nivel_hierarquia": 3,
  "empresa_nome": "Fazenda Santa Isabel",
  "fazendas_acesso": [
    {
      "id": 3,
      "nome": "Sede Santa Isabel",
      "codigo": "SI001"
    },
    {
      "id": 4,
      "nome": "Unidade Chapada",
      "codigo": "SI002"
    }
  ]
}

2. LISTA DE USUÁRIOS (resposta paginada):
{
  "sucesso": true,
  "mensagem": "Usuários listados com sucesso",
  "dados": [
    // array de usuários
  ],
  "paginacao": {
    "total": 25,
    "pagina_atual": 1,
    "limite": 10,
    "total_paginas": 3,
    "tem_proxima": true,
    "tem_anterior": false
  },
  "timestamp": "2024-12-20T15:30:00.000Z"
}

3. PERFIS DISPONÍVEIS:
{
  "sucesso": true,
  "dados": [
    {
      "id": 2,
      "nome": "Admin Empresa",
      "descricao": "Administrador da empresa/fazenda",
      "nivel_hierarquia": 2
    },
    {
      "id": 3,
      "nome": "Gerente",
      "descricao": "Gerente da fazenda",
      "nivel_hierarquia": 3
    },
    {
      "id": 4,
      "nome": "Operador",
      "descricao": "Operador de campo/estoque",
      "nivel_hierarquia": 4
    },
    {
      "id": 5,
      "nome": "Somente Leitura",
      "descricao": "Acesso apenas para consulta",
      "nivel_hierarquia": 5
    }
  ]
}

4. FAZENDAS DISPONÍVEIS:
{
  "sucesso": true,
  "dados": [
    {
      "id": 3,
      "nome": "Sede Santa Isabel",
      "codigo": "SI001",
      "cidade": "Bom Jesus",
      "estado": "PI",
      "area_total_hectares": "3200.00"
    },
    {
      "id": 4,
      "nome": "Unidade Chapada",
      "codigo": "SI002",
      "cidade": "Bom Jesus",
      "estado": "PI",
      "area_total_hectares": "2800.00"
    }
  ]
}

EXEMPLOS DE USO NO FRONTEND REACT/NEXT.JS:

1. LISTAR USUÁRIOS:
```javascript
const listarUsuarios = async (filtros = {}, pagina = 1) => {
  const params = new URLSearchParams({
    pagina: pagina.toString(),
    limite: '10',
    ...filtros
  });

  const response = await fetch(`/api/usuarios?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  return await response.json();
};
```

2. CRIAR USUÁRIO:
```javascript
const criarUsuario = async (dadosUsuario) => {
  const response = await fetch('/api/usuarios', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(dadosUsuario)
  });

  return await response.json();
};
```

3. ATUALIZAR USUÁRIO:
```javascript
const atualizarUsuario = async (id, dadosUsuario) => {
  const response = await fetch(`/api/usuarios/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(dadosUsuario)
  });

  return await response.json();
};
```

4. EXCLUIR USUÁRIO:
```javascript
const excluirUsuario = async (id) => {
  const response = await fetch(`/api/usuarios/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  return await response.json();
};
```

5. BUSCAR DADOS AUXILIARES:
```javascript
const buscarPerfis = async () => {
  const response = await fetch('/api/usuarios/perfis', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  return await response.json();
};

const buscarFazendas = async () => {
  const response = await fetch('/api/usuarios/fazendas', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  return await response.json();
};
```

COMPONENTES SUGERIDOS PARA O FRONTEND:

1. ListaUsuarios - Tabela com filtros e paginação
2. FormularioUsuario - Modal/página para criar/editar
3. DetalheUsuario - Visualização completa do usuário
4. FiltrosUsuarios - Componente de filtros (perfil, fazenda, busca)
5. ConfirmacaoExclusao - Modal de confirmação para exclusão

CAMPOS DO FORMULÁRIO:

Obrigatórios:
- perfil_id (select com perfis disponíveis)
- nome (input text)
- login (input text)
- email (input email)
- senha (input password - apenas na criação)

Opcionais:
- cpf (input text com máscara)
- telefone (input text com máscara)
- cargo (input text)
- fazendas_acesso (multi-select com fazendas)
- ativo (checkbox - apenas na edição)

VALIDAÇÕES NO FRONTEND:

- Email: formato válido
- CPF: validação de CPF brasileiro (se preenchido)
- Telefone: formato brasileiro (se preenchido)
- Senha: mínimo 6 caracteres, 1 letra, 1 número
- Login: único, sem espaços, minúsculas

*/