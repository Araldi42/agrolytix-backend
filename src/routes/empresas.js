/**
 * Rotas de Empresas
 * Endpoints para gerenciamento de empresas no sistema SaaS
 */

const express = require('express');
const router = express.Router();
const empresasController = require('../controllers/empresasController');
const { autenticacao } = require('../middlewares/authorizationMiddleware');

// Middleware de autenticação para todas as rotas
router.use(autenticacao);

/**
 * @route GET /api/empresas/simplificado
 * @desc Listar empresas simplificado para dropdowns (apenas ID e nome)
 * @access Private (Admin Sistema)
 */
router.get('/simplificado', empresasController.listarSimplificado.bind(empresasController));

/**
 * @route GET /api/empresas/dashboard/geral
 * @desc Dashboard de empresas (apenas admin sistema)
 * @access Private (Admin Sistema)
 */
router.get('/dashboard/geral', empresasController.dashboard.bind(empresasController));

/**
 * @route GET /api/empresas/relatorio/geral
 * @desc Relatório de empresas (apenas admin sistema)
 * @access Private (Admin Sistema)
 */
router.get('/relatorio/geral', empresasController.relatorio.bind(empresasController));

/**
 * @route GET /api/empresas/vencimento/proximo
 * @desc Buscar empresas com vencimento próximo (apenas admin sistema)
 * @access Private (Admin Sistema)
 */
router.get('/vencimento/proximo', empresasController.vencimentoProximo.bind(empresasController));

/**
 * @route GET /api/empresas/vencimento/vencidas
 * @desc Buscar empresas vencidas (apenas admin sistema)
 * @access Private (Admin Sistema)
 */
router.get('/vencimento/vencidas', empresasController.vencidas.bind(empresasController));

/**
 * @route GET /api/empresas
 * @desc Listar empresas (apenas admin sistema)
 * @access Private (Admin Sistema)
 */
router.get('/', empresasController.listar.bind(empresasController));

/**
 * @route GET /api/empresas/:id
 * @desc Buscar empresa por ID com estatísticas
 * @access Private (Admin Sistema ou Própria Empresa)
 */
router.get('/:id', empresasController.buscarPorId.bind(empresasController));

/**
 * @route POST /api/empresas
 * @desc Criar nova empresa (apenas admin sistema)
 * @access Private (Admin Sistema)
 */
router.post('/', empresasController.criar.bind(empresasController));

/**
 * @route PUT /api/empresas/:id
 * @desc Atualizar empresa existente
 * @access Private (Admin Sistema ou Própria Empresa)
 */
router.put('/:id', empresasController.atualizar.bind(empresasController));

/**
 * @route DELETE /api/empresas/:id
 * @desc Excluir empresa (soft delete - apenas admin sistema)
 * @access Private (Admin Sistema)
 */
router.delete('/:id', empresasController.excluir.bind(empresasController));

/**
 * @route GET /api/empresas/:id/estatisticas
 * @desc Obter estatísticas da empresa
 * @access Private (Admin Sistema ou Própria Empresa)
 */
router.get('/:id/estatisticas', empresasController.estatisticas.bind(empresasController));

/**
 * @route GET /api/empresas/:id/fazendas
 * @desc Buscar fazendas da empresa
 * @access Private (Admin Sistema ou Própria Empresa)
 */
router.get('/:id/fazendas', empresasController.fazendas.bind(empresasController));

/**
 * @route GET /api/empresas/:id/usuarios
 * @desc Buscar usuários da empresa
 * @access Private (Admin Sistema ou Própria Empresa)
 */
router.get('/:id/usuarios', empresasController.usuarios.bind(empresasController));

module.exports = router; 