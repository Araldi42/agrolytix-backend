const express = require('express');
const autenticacaoController = require('../controllers/autenticacaoController');
const { autenticacao } = require('../middlewares/autenticacao');

const router = express.Router();

/**
 * @route POST /api/auth/login
 * @desc Login do usuário
 * @access Public
 */
router.post('/login', autenticacaoController.login);

/**
 * @route POST /api/auth/cadastro
 * @desc Cadastro de novo usuário
 * @access Public
 */
router.post('/cadastro', autenticacaoController.cadastro);

/**
 * @route GET /api/auth/verificar
 * @desc Verificar se o usuário está autenticado
 * @access Public
 */
router.get('/verificar', autenticacaoController.verificar);

/**
 * @route POST /api/auth/logout
 * @desc Logout do usuário
 * @access Public
 */
router.post('/logout', autenticacaoController.logout);

/**
 * @route POST /api/auth/renovar-token
 * @desc Renovar token JWT
 * @access Private
 */
router.post('/renovar-token', autenticacao, autenticacaoController.renovarToken);

module.exports = router;