const express = require('express');
const ativosController = require('../controllers/ativosController');
const { autenticacao } = require('../middlewares/autenticacao');

const router = express.Router();

// Aplicar middleware de autenticação em todas as rotas
router.use(autenticacao);

/**
 * @route GET /api/ativos
 * @desc Buscar todos os ativos
 * @access Private
 */
router.get('/', ativosController.buscarTodos);

/**
 * @route GET /api/ativos/:id
 * @desc Buscar ativo por ID
 * @access Private
 */
router.get('/:id', ativosController.buscarPorId);

/**
 * @route POST /api/ativos
 * @desc Criar novo ativo
 * @access Private
 */
router.post('/', ativosController.criar);

/**
 * @route PUT /api/ativos/:id
 * @desc Atualizar ativo
 * @access Private
 */
router.put('/:id', ativosController.atualizar);

/**
 * @route DELETE /api/ativos/:id
 * @desc Excluir ativo
 * @access Private
 */
router.delete('/:id', ativosController.excluir);

module.exports = router;