const express = require('express');
const usuariosController = require('../controllers/usuariosController');
const { autenticacao, requerNivel, podeGerenciarUsuarios } = require('../middlewares/authorizationMiddleware');

const router = express.Router();

// Aplicar middleware de autenticação em todas as rotas
router.use(autenticacao);

/**
 * @route GET /api/usuarios
 * @desc Listar usuários da empresa
 * @access Private - Requer nível gerente ou superior
 */
router.get('/',
    requerNivel(3),
    usuariosController.listar
);

/**
 * @route GET /api/usuarios/:id
 * @desc Buscar usuário por ID
 * @access Private
 */
router.get('/:id', usuariosController.buscarPorId);

/**
 * @route POST /api/usuarios
 * @desc Criar novo usuário
 * @access Private - Requer permissão para gerenciar usuários
 */
router.post('/',
    podeGerenciarUsuarios,
    usuariosController.criar
);

/**
 * @route PUT /api/usuarios/:id
 * @desc Atualizar usuário
 * @access Private
 */
router.put('/:id', usuariosController.atualizar);

/**
 * @route PUT /api/usuarios/:id/inativar
 * @desc Inativar usuário
 * @access Private - Requer permissão para gerenciar usuários
 */
router.put('/:id/inativar',
    podeGerenciarUsuarios,
    usuariosController.inativar
);

/**
 * @route PUT /api/usuarios/:id/reativar
 * @desc Reativar usuário
 * @access Private - Requer permissão para gerenciar usuários
 */
router.put('/:id/reativar',
    podeGerenciarUsuarios,
    usuariosController.reativar
);

/**
 * @route PUT /api/usuarios/:id/alterar-senha
 * @desc Alterar senha do usuário
 * @access Private
 */
router.put('/:id/alterar-senha', usuariosController.alterarSenha);

/**
 * @route GET /api/usuarios/perfil/:perfil_id
 * @desc Buscar usuários por perfil
 * @access Private - Requer nível gerente ou superior
 */
router.get('/perfil/:perfil_id',
    requerNivel(3),
    usuariosController.buscarPorPerfil
);

/**
 * @route GET /api/usuarios/cargo
 * @desc Buscar usuários por cargo
 * @access Private - Requer nível gerente ou superior
 */
router.get('/filters/cargo',
    requerNivel(3),
    usuariosController.buscarPorCargo
);

/**
 * @route GET /api/usuarios/stats/inativos
 * @desc Buscar usuários inativos
 * @access Private - Requer nível gerente ou superior
 */
router.get('/stats/inativos',
    requerNivel(3),
    usuariosController.usuariosInativos
);

/**
 * @route PUT /api/usuarios/:id/fazendas
 * @desc Gerenciar acesso às fazendas
 * @access Private - Requer permissão para gerenciar usuários
 */
router.put('/:id/fazendas',
    podeGerenciarUsuarios,
    usuariosController.gerenciarFazendas
);

/**
 * @route GET /api/usuarios/:id/fazendas
 * @desc Buscar fazendas do usuário
 * @access Private
 */
router.get('/:id/fazendas', usuariosController.fazendasUsuario);

/**
 * @route GET /api/usuarios/stats/estatisticas
 * @desc Obter estatísticas de usuários
 * @access Private - Requer nível gerente ou superior
 */
router.get('/stats/estatisticas',
    requerNivel(3),
    usuariosController.estatisticas
);

/**
 * @route GET /api/usuarios/stats/dashboard
 * @desc Dashboard de usuários
 * @access Private - Requer nível gerente ou superior
 */
router.get('/stats/dashboard',
    requerNivel(3),
    usuariosController.dashboard
);

module.exports = router;