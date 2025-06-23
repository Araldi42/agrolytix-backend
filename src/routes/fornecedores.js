const express = require('express');
const fornecedoresController = require('../controllers/fornecedoresController');
const { autenticacao, requerNivel } = require('../middlewares/authorizationMiddleware');

const router = express.Router();

// Aplicar middleware de autenticação em todas as rotas
router.use(autenticacao);

/**
 * @route GET /api/fornecedores
 * @desc Listar fornecedores com paginação e filtros
 * @access Private
 */
router.get('/', fornecedoresController.listar);

/**
 * @route GET /api/fornecedores/:id
 * @desc Buscar fornecedor por ID
 * @access Private
 */
router.get('/:id', fornecedoresController.buscarPorId);

/**
 * @route POST /api/fornecedores
 * @desc Criar novo fornecedor
 * @access Private - Requer nível gerente ou superior
 */
router.post('/',
    requerNivel(3),
    fornecedoresController.criar
);

/**
 * @route PUT /api/fornecedores/:id
 * @desc Atualizar fornecedor
 * @access Private - Requer nível gerente ou superior
 */
router.put('/:id',
    requerNivel(3),
    fornecedoresController.atualizar
);

/**
 * @route DELETE /api/fornecedores/:id
 * @desc Excluir fornecedor
 * @access Private - Requer nível gerente ou superior
 */
router.delete('/:id',
    requerNivel(3),
    fornecedoresController.excluir
);

/**
 * @route GET /api/fornecedores/:id/produtos
 * @desc Buscar produtos do fornecedor
 * @access Private
 */
router.get('/:id/produtos', fornecedoresController.produtos);

/**
 * @route PUT /api/fornecedores/:id/rating
 * @desc Atualizar rating do fornecedor
 * @access Private - Requer nível gerente ou superior
 */
router.put('/:id/rating',
    requerNivel(3),
    fornecedoresController.atualizarRating
);

/**
 * @route GET /api/fornecedores/stats/mais-utilizados
 * @desc Buscar fornecedores mais utilizados
 * @access Private
 */
router.get('/stats/mais-utilizados', fornecedoresController.maisUtilizados);

/**
 * @route GET /api/fornecedores/stats/por-localizacao
 * @desc Buscar fornecedores por localização
 * @access Private
 */
router.get('/stats/por-localizacao', fornecedoresController.porLocalizacao);

/**
 * @route GET /api/fornecedores/stats/rating-baixo
 * @desc Buscar fornecedores com rating baixo
 * @access Private
 */
router.get('/stats/rating-baixo', fornecedoresController.ratingBaixo);

/**
 * @route GET /api/fornecedores/stats/estatisticas
 * @desc Obter estatísticas dos fornecedores
 * @access Private
 */
router.get('/stats/estatisticas', fornecedoresController.estatisticas);

/**
 * @route GET /api/fornecedores/stats/dashboard
 * @desc Dashboard de fornecedores
 * @access Private
 */
router.get('/stats/dashboard', fornecedoresController.dashboard);

/**
 * @route GET /api/fornecedores/admin/globais
 * @desc Buscar fornecedores globais
 * @access Private
 */
router.get('/admin/globais', fornecedoresController.globais);

/**
 * @route POST /api/fornecedores/admin/globais
 * @desc Criar fornecedor global (apenas admin sistema)
 * @access Private - Admin sistema apenas
 */
router.post('/admin/globais',
    requerNivel(1),
    fornecedoresController.criarGlobal
);

module.exports = router;