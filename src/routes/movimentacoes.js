const express = require('express');
const movimentacoesController = require('../controllers/movimentacoesController');
const { autenticacao, requerPermissao } = require('../middlewares/authorizationMiddleware');

const router = express.Router();

// Aplicar autenticação em todas as rotas
router.use(autenticacao);

/**
 * @route GET /api/movimentacoes
 * @desc Listar movimentações com filtros e paginação
 * @access Private
 */
router.get('/', 
    requerPermissao('movimentacoes', 'visualizar'),
    movimentacoesController.listar
);

/**
 * @route GET /api/movimentacoes/:id
 * @desc Buscar movimentação por ID
 * @access Private
 */
router.get('/:id', 
    requerPermissao('movimentacoes', 'visualizar'),
    movimentacoesController.buscarPorId
);

/**
 * @route POST /api/movimentacoes
 * @desc Criar nova movimentação
 * @access Private
 */
router.post('/', 
    requerPermissao('movimentacoes', 'criar'),
    movimentacoesController.criar
);

module.exports = router; 