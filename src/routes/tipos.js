const express = require('express');
const tiposController = require('../controllers/tiposController');
const { autenticacao } = require('../middlewares/autenticacao');

const router = express.Router();

// Aplicar middleware de autenticação em todas as rotas
router.use(autenticacao);

/**
 * @route GET /api/tipos
 * @desc Buscar todos os tipos
 * @access Private
 */
router.get('/', tiposController.buscarTodos);

/**
 * @route GET /api/tipos/:id
 * @desc Buscar tipo por ID
 * @access Private
 */
router.get('/:id', tiposController.buscarPorId);

/**
 * @route POST /api/tipos
 * @desc Criar novo tipo
 * @access Private
 */
router.post('/', tiposController.criar);

/**
 * @route PUT /api/tipos/:id
 * @desc Atualizar tipo
 * @access Private
 */
router.put('/:id', tiposController.atualizar);

/**
 * @route DELETE /api/tipos/:id
 * @desc Excluir tipo
 * @access Private
 */
router.delete('/:id', tiposController.excluir);

module.exports = router;