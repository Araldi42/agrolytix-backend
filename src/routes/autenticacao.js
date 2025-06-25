const express = require('express');
const autenticacaoController = require('../controllers/autenticacaoController');
const { autenticacao } = require('../middlewares/autenticacao');

const router = express.Router();

/**
 * @route POST /api/auth/login
 * @desc Login do usuário
 * @access Public
 */
router.post('/login', autenticacaoController.login.bind(autenticacaoController));

/**
 * @route POST /api/auth/cadastro
 * @desc Cadastro de novo usuário
 * @access Public
 */
router.post('/cadastro', autenticacaoController.cadastro.bind(autenticacaoController));

/**
 * @route GET /api/auth/verificar
 * @desc Verificar se o usuário está autenticado
 * @access Public
 */
router.get('/verificar', autenticacaoController.verificar.bind(autenticacaoController));

/**
 * @route POST /api/auth/logout
 * @desc Logout do usuário
 * @access Private
 */
router.post('/logout', autenticacao, autenticacaoController.logout.bind(autenticacaoController));

/**
 * @route POST /api/auth/renovar-token
 * @desc Renovar token JWT
 * @access Private
 */
router.post('/renovar-token', autenticacao, autenticacaoController.renovarToken.bind(autenticacaoController));

/**
 * @route POST /api/auth/alterar-senha
 * @desc Alterar senha do usuário logado
 * @access Private
 */
router.post('/alterar-senha', autenticacao, autenticacaoController.alterarSenha.bind(autenticacaoController));

/**
 * @route POST /api/auth/recuperar-senha
 * @desc Solicitar recuperação de senha
 * @access Public
 */
router.post('/recuperar-senha', autenticacaoController.solicitarRecuperacao.bind(autenticacaoController));

/**
 * @route POST /api/auth/redefinir-senha
 * @desc Redefinir senha com token
 * @access Public
 */
router.post('/redefinir-senha', autenticacaoController.redefinirSenha.bind(autenticacaoController));

/**
 * @route GET /api/auth/meu-perfil
 * @desc Obter perfil do usuário logado
 * @access Private
 */
router.get('/meu-perfil', autenticacao, autenticacaoController.meuPerfil.bind(autenticacaoController));

/**
 * @route PUT /api/auth/meu-perfil
 * @desc Atualizar perfil do usuário logado
 * @access Private
 */
router.put('/meu-perfil', autenticacao, autenticacaoController.atualizarMeuPerfil.bind(autenticacaoController));

/**
 * @route GET /api/auth/sessoes
 * @desc Listar sessões ativas
 * @access Private
 */
router.get('/sessoes', autenticacao, autenticacaoController.sessõesAtivas.bind(autenticacaoController));

/**
 * @route GET /api/auth/status-conta
 * @desc Verificar status da conta
 * @access Private
 */
router.get('/status-conta', autenticacao, autenticacaoController.statusConta.bind(autenticacaoController));

module.exports = router;