const express = require('express');
const usuariosController = require('../controllers/usuariosController');
const {
    autenticacao,
    requerNivel,
    requerPermissao,
    requerEmpresa,
    requerFazenda,
    podeGerenciarUsuarios,
    rateLimiting
} = require('../middlewares/authorizationMiddleware');

const router = express.Router();

// Aplicar middleware de autenticação em todas as rotas
router.use(autenticacao);

// Rate limiting opcional para todas as rotas de usuários
// router.use(rateLimiting(200, 15 * 60 * 1000)); // 200 requests por 15 min

/**
 * ⚠️ IMPORTANTE: ROTAS ESPECÍFICAS DEVEM VIR ANTES DAS ROTAS COM PARÂMETROS ⚠️
 */

/**
 * ROTAS DE ESTATÍSTICAS E RELATÓRIOS
 */

/**
 * @route GET /api/usuarios/stats/dashboard
 * @desc Dashboard completo de usuários
 * @access Private - Requer nível gerente ou superior (3)
 */
router.get('/stats/dashboard',
    requerNivel(3),
    usuariosController.dashboard.bind(usuariosController)
);

/**
 * @route GET /api/usuarios/stats/estatisticas
 * @desc Obter estatísticas gerais de usuários
 * @access Private - Requer nível gerente ou superior (3)
 */
router.get('/stats/estatisticas',
    requerNivel(3),
    usuariosController.estatisticas.bind(usuariosController)
);

/**
 * @route GET /api/usuarios/stats/inativos
 * @desc Buscar usuários inativos por período
 * @access Private - Requer nível gerente ou superior (3)
 * @param {number} dias - Número de dias de inatividade (query param)
 */
router.get('/stats/inativos',
    requerNivel(3),
    usuariosController.usuariosInativos.bind(usuariosController)
);

/**
 * ROTAS DE FILTROS E BUSCAS ESPECÍFICAS
 */

/**
 * @route GET /api/usuarios/filters/cargo
 * @desc Buscar usuários por cargo
 * @access Private - Requer nível gerente ou superior (3)
 * @param {string} cargo - Cargo para buscar (query param)
 */
router.get('/filters/cargo',
    requerNivel(3),
    usuariosController.buscarPorCargo.bind(usuariosController)
);

/**
 * @route GET /api/usuarios/perfil/:perfil_id
 * @desc Buscar usuários por perfil específico
 * @access Private - Requer nível gerente ou superior (3)
 * @param {number} perfil_id - ID do perfil
 */
router.get('/perfil/:perfil_id',
    requerNivel(3),
    usuariosController.buscarPorPerfil.bind(usuariosController)
);

/**
 * ROTAS PRINCIPAIS DE CRUD
 */

/**
 * @route GET /api/usuarios
 * @desc Listar usuários da empresa
 * @access Private - Requer nível gerente ou superior (3)
 * @param {string} search - Termo de busca (query param)
 * @param {number} perfil_id - Filtrar por perfil (query param)
 * @param {boolean} ativo - Filtrar por status ativo (query param)
 * @param {number} page - Página atual (query param)
 * @param {number} limit - Itens por página (query param)
 */
router.get('/',
    requerNivel(3),
    usuariosController.listar.bind(usuariosController)
);

/**
 * @route POST /api/usuarios
 * @desc Criar novo usuário
 * @access Private - Requer permissão para gerenciar usuários
 * @body {Object} userData - Dados do usuário
 * @body {string} senha - Senha do usuário
 * @body {string} confirmar_senha - Confirmação da senha
 * @body {Array} fazendas_ids - Array de IDs das fazendas (opcional)
 */
router.post('/',
    podeGerenciarUsuarios,
    usuariosController.criar.bind(usuariosController)
);

/**
 * ROTAS COM PARÂMETROS DE ID (devem vir por último)
 */

/**
 * @route GET /api/usuarios/:id
 * @desc Buscar usuário por ID com detalhes completos
 * @access Private - Usuário pode ver próprio perfil OU gerentes podem ver outros
 * @param {number} id - ID do usuário
 */
router.get('/:id',
    usuariosController.buscarPorId.bind(usuariosController)
);

/**
 * @route PUT /api/usuarios/:id
 * @desc Atualizar dados do usuário
 * @access Private - Usuário pode editar próprio perfil OU gerentes podem editar outros
 * @param {number} id - ID do usuário
 * @body {Object} userData - Dados para atualizar
 * @body {Array} fazendas_ids - Array de IDs das fazendas (opcional)
 */
router.put('/:id',
    usuariosController.atualizar.bind(usuariosController)
);

/**
 * @route PUT /api/usuarios/:id/inativar
 * @desc Inativar usuário
 * @access Private - Requer permissão para gerenciar usuários
 * @param {number} id - ID do usuário
 */
router.put('/:id/inativar',
    podeGerenciarUsuarios,
    usuariosController.inativar.bind(usuariosController)
);

/**
 * @route PUT /api/usuarios/:id/reativar
 * @desc Reativar usuário inativo
 * @access Private - Requer permissão para gerenciar usuários
 * @param {number} id - ID do usuário
 */
router.put('/:id/reativar',
    podeGerenciarUsuarios,
    usuariosController.reativar.bind(usuariosController)
);

/**
 * @route PUT /api/usuarios/:id/alterar-senha
 * @desc Alterar senha do usuário
 * @access Private - Usuário pode alterar própria senha OU admins podem alterar qualquer senha
 * @param {number} id - ID do usuário
 * @body {string} senha_atual - Senha atual (obrigatória para próprio usuário)
 * @body {string} nova_senha - Nova senha
 * @body {string} confirmar_senha - Confirmação da nova senha
 */
router.put('/:id/alterar-senha',
    usuariosController.alterarSenha.bind(usuariosController)
);

/**
 * ROTAS DE GERENCIAMENTO DE FAZENDAS
 */

/**
 * @route PUT /api/usuarios/:id/fazendas
 * @desc Gerenciar acesso do usuário às fazendas
 * @access Private - Requer permissão para gerenciar usuários
 * @param {number} id - ID do usuário
 * @body {Array} fazendas_ids - Array de IDs das fazendas
 */
router.put('/:id/fazendas',
    podeGerenciarUsuarios,
    usuariosController.gerenciarFazendas.bind(usuariosController)
);

/**
 * @route GET /api/usuarios/:id/fazendas
 * @desc Buscar fazendas que o usuário tem acesso
 * @access Private - Usuário pode ver próprias fazendas OU gerentes podem ver de outros
 * @param {number} id - ID do usuário
 */
router.get('/:id/fazendas',
    usuariosController.fazendasUsuario.bind(usuariosController)
);

/**
 * ROTAS DE TESTE E DEBUG (remover em produção)
 */

/**
 * @route GET /api/usuarios/test/auth
 * @desc Rota de teste para verificar autenticação
 * @access Private - Qualquer usuário autenticado
 */
router.get('/test/auth', (req, res) => {
    res.json({
        sucesso: true,
        mensagem: 'Autenticação funcionando',
        usuario: {
            id: req.usuario.id,
            nome: req.usuario.nome,
            email: req.usuario.email,
            empresa_id: req.usuario.empresa_id,
            nivel_hierarquia: req.usuario.nivel_hierarquia,
            perfil_nome: req.usuario.perfil_nome
        },
        timestamp: new Date().toISOString()
    });
});

/**
 * MIDDLEWARE DE TRATAMENTO DE ERROS ESPECÍFICO PARA USUÁRIOS
 */
router.use((error, req, res, next) => {
    console.error('Erro nas rotas de usuários:', error);

    // Erros específicos do módulo de usuários
    if (error.code === '23505') { // Violação de unicidade (PostgreSQL)
        if (error.constraint?.includes('login')) {
            return res.status(409).json({
                sucesso: false,
                mensagem: 'Login já está em uso',
                detalhes: ['Escolha outro login']
            });
        }
        if (error.constraint?.includes('email')) {
            return res.status(409).json({
                sucesso: false,
                mensagem: 'Email já está em uso',
                detalhes: ['Escolha outro email']
            });
        }
    }

    if (error.code === '23503') { // Violação de chave estrangeira
        return res.status(400).json({
            sucesso: false,
            mensagem: 'Dados relacionados inválidos',
            detalhes: ['Verifique se empresa e perfil existem']
        });
    }

    // Passar para o middleware global de erros
    next(error);
});

module.exports = router;