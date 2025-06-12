const express = require('express');
const fornecedoresController = require('../controllers/fornecedoresController');
const { autenticacao } = require('../middlewares/autenticacao');

const router = express.Router();

// Aplicar middleware de autenticação em todas as rotas
router.use(autenticacao);

/**
 * @route GET /api/fornecedores
 * @desc Buscar todos os fornecedores
 * @access Private
 */
router.get('/', fornecedoresController.buscarTodos);

/**
 * @route GET /api/fornecedores/:id
 * @desc Buscar fornecedor por ID
 * @access Private
 */
router.get('/:id', fornecedoresController.buscarPorId);

/**
 * @route POST /api/fornecedores
 * @desc Criar novo fornecedor
 * @access Private
 */
router.post('/', fornecedoresController.criar);

/**
 * @route PUT /api/fornecedores/:id
 * @desc Atualizar fornecedor
 * @access Private
 */
router.put('/:id', fornecedoresController.atualizar);

/**
 * @route DELETE /api/fornecedores/:id
 * @desc Excluir fornecedor
 * @access Private
 */
router.delete('/:id', fornecedoresController.excluir);

module.exports = router;