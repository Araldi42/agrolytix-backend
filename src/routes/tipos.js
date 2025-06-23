const express = require('express');
const tiposController = require('../controllers/tiposController');
const { autenticacao, requerNivel } = require('../middlewares/authorizationMiddleware');

const router = express.Router();

// Aplicar middleware de autenticação em todas as rotas
router.use(autenticacao);

/**
 * @route GET /api/tipos
 * @desc Listar tipos com paginação e filtros
 * @access Private
 */
router.get('/', tiposController.listar);

/**
 * @route GET /api/tipos/:id
 * @desc Buscar tipo por ID
 * @access Private
 */
router.get('/:id', tiposController.buscarPorId);

/**
 * @route POST /api/tipos
 * @desc Criar novo tipo
 * @access Private - Requer nível gerente ou superior
 */
router.post('/',
    requerNivel(3),
    tiposController.criar
);

/**
 * @route PUT /api/tipos/:id
 * @desc Atualizar tipo
 * @access Private - Requer nível gerente ou superior
 */
router.put('/:id',
    requerNivel(3),
    tiposController.atualizar
);

/**
 * @route DELETE /api/tipos/:id
 * @desc Excluir tipo
 * @access Private - Requer nível gerente ou superior
 */
router.delete('/:id',
    requerNivel(3),
    tiposController.excluir
);

/**
 * @route GET /api/tipos/categoria/:categoria_id
 * @desc Buscar tipos por categoria
 * @access Private
 */
router.get('/categoria/:categoria_id', tiposController.porCategoria);

/**
 * @route GET /api/tipos/:id/produtos
 * @desc Buscar produtos do tipo
 * @access Private
 */
router.get('/:id/produtos', tiposController.produtos);

/**
 * @route GET /api/tipos/stats/mais-utilizados
 * @desc Buscar tipos mais utilizados
 * @access Private
 */
router.get('/stats/mais-utilizados', tiposController.maisUtilizados);

/**
 * @route GET /api/tipos/stats/estoque-baixo
 * @desc Buscar tipos com estoque baixo
 * @access Private
 */
router.get('/stats/estoque-baixo', tiposController.estoqueBaixo);

/**
 * @route GET /api/tipos/stats/unidades-medida
 * @desc Buscar unidades de medida disponíveis
 * @access Private
 */
router.get('/stats/unidades-medida', tiposController.unidadesMedida);

/**
 * @route GET /api/tipos/stats/estatisticas
 * @desc Obter estatísticas dos tipos
 * @access Private
 */
router.get('/stats/estatisticas', tiposController.estatisticas);

/**
 * @route GET /api/tipos/stats/dashboard
 * @desc Dashboard de tipos
 * @access Private
 */
router.get('/stats/dashboard', tiposController.dashboard);

/**
 * @route GET /api/tipos/admin/globais
 * @desc Buscar tipos globais
 * @access Private
 */
router.get('/admin/globais', tiposController.globais);

/**
 * @route POST /api/tipos/admin/globais
 * @desc Criar tipo global (apenas admin sistema)
 * @access Private - Admin sistema apenas
 */
router.post('/admin/globais',
    requerNivel(1),
    tiposController.criarGlobal
);

/**
 * @route POST /api/tipos/actions/importar
 * @desc Importar tipos de outra categoria
 * @access Private - Requer nível gerente ou superior
 */
router.post('/actions/importar',
    requerNivel(3),
    tiposController.importarDeCategoria
);

module.exports = router;