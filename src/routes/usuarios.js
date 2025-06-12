const express = require('express');
const usuariosController = require('../controllers/usuariosController');
const { autenticacao } = require('../middlewares/autenticacao');

const router = express.Router();

// Aplicar middleware de autenticação em todas as rotas
router.use(autenticacao);

/**
 * @route GET /api/usuarios
 * @desc Buscar todos os usuários
 * @access Private
 */
router.get('/', usuariosController.buscarTodos);

/**
 * @route GET /api/usuarios/:id
 * @desc Buscar usuário por ID
 * @access Private
 */
router.get('/:id', usuariosController.buscarPorId);

/**
 * @route PUT /api/usuarios/:id
 * @desc Atualizar usuário
 * @access Private
 */
router.put('/:id', usuariosController.atualizar);

/**
 * @route DELETE /api/usuarios/:id
 * @desc Excluir usuário
 * @access Private
 */
router.delete('/:id', usuariosController.excluir);

module.exports = router;