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
    usuariosController.listar.bind(usuariosController)
);

/**
 * @route GET /api/usuarios/:id
 * @desc Buscar usuário por ID
 * @access Private
 */
router.get('/:id', usuariosController.buscarPorId.bind(usuariosController));

/**
 * @route POST /api/usuarios
 * @desc Criar novo usuário
 * @access Private - Requer permissão para gerenciar usuários
 */
router.post('/',
    podeGerenciarUsuarios,
    usuariosController.criar.bind(usuariosController)
);

/**
 * @route PUT /api/usuarios/:id
 * @desc Atualizar usuário
 * @access Private
 */
router.put('/:id', usuariosController.atualizar.bind(usuariosController));

/**
 * @route PUT /api/usuarios/:id/inativar
 * @desc Inativar usuário
 * @access Private - Requer permissão para gerenciar usuários
 */
router.put('/:id/inativar',
    podeGerenciarUsuarios,
    usuariosController.inativar.bind(usuariosController)
);

/**
 * @route PUT /api/usuarios/:id/reativar
 * @desc Reativar usuário
 * @access Private - Requer permissão para gerenciar usuários
 */
router.put('/:id/reativar',
    podeGerenciarUsuarios,
    usuariosController.reativar.bind(usuariosController)
);

/**
 * @route PUT /api/usuarios/:id/alterar-senha
 * @desc Alterar senha do usuário
 * @access Private
 */
router.put('/:id/alterar-senha', usuariosController.alterarSenha.bind(usuariosController));

/**
 * @route GET /api/usuarios/perfil/:perfil_id
 * @desc Buscar usuários por perfil
 * @access Private - Requer nível gerente ou superior
 */
router.get('/perfil/:perfil_id',
    requerNivel(3),
    usuariosController.buscarPorPerfil.bind(usuariosController)
);

/**
 * @route GET /api/usuarios/cargo
 * @desc Buscar usuários por cargo
 * @access Private - Requer nível gerente ou superior
 */
router.get('/filters/cargo',
    requerNivel(3),
    usuariosController.buscarPorCargo.bind(usuariosController)
);

/**
 * @route GET /api/usuarios/stats/inativos
 * @desc Buscar usuários inativos
 * @access Private - Requer nível gerente ou superior
 */
router.get('/stats/inativos',
    requerNivel(3),
    usuariosController.usuariosInativos.bind(usuariosController)
);

/**
 * @route PUT /api/usuarios/:id/fazendas
 * @desc Gerenciar acesso às fazendas
 * @access Private - Requer permissão para gerenciar usuários
 */
router.put('/:id/fazendas',
    podeGerenciarUsuarios,
    usuariosController.gerenciarFazendas.bind(usuariosController)
);

/**
 * @route GET /api/usuarios/:id/fazendas
 * @desc Buscar fazendas do usuário
 * @access Private
 */
router.get('/:id/fazendas', usuariosController.fazendasUsuario.bind(usuariosController));

/**
 * @route GET /api/usuarios/stats/estatisticas
 * @desc Obter estatísticas de usuários
 * @access Private - Requer nível gerente ou superior
 */
router.get('/stats/estatisticas',
    requerNivel(3),
    usuariosController.estatisticas.bind(usuariosController)
);

/**
 * @route GET /api/usuarios/stats/dashboard
 * @desc Dashboard de usuários
 * @access Private - Requer nível gerente ou superior
 */
router.get('/stats/dashboard',
    requerNivel(3),
    usuariosController.dashboard.bind(usuariosController)
);

module.exports = router;