const express = require('express');
const categoriasController = require('../controllers/categoriasController');
const { autenticacao, requerNivel, requerPermissao } = require('../middlewares/authorizationMiddleware');

const router = express.Router();

// Aplicar middleware de autenticação em todas as rotas
router.use(autenticacao);

/**
 * @route GET /api/categorias
 * @desc Listar categorias com paginação e filtros
 * @access Private
 */
router.get('/', categoriasController.listar.bind(categoriasController));

/**
 * @route GET /api/categorias/:id
 * @desc Buscar categoria por ID
 * @access Private
 */
router.get('/:id', categoriasController.buscarPorId.bind(categoriasController));

/**
 * @route POST /api/categorias
 * @desc Criar nova categoria
 * @access Private - Requer nível gerente ou superior
 */
router.post('/',
    requerNivel(3),
    categoriasController.criar.bind(categoriasController)
);

/**
 * @route PUT /api/categorias/:id
 * @desc Atualizar categoria
 * @access Private - Requer nível gerente ou superior
 */
router.put('/:id',
    requerNivel(3),
    categoriasController.atualizar.bind(categoriasController)
);

/**
 * @route DELETE /api/categorias/:id
 * @desc Excluir categoria
 * @access Private - Requer nível gerente ou superior
 */
router.delete('/:id',
    requerNivel(3),
    categoriasController.excluir.bind(categoriasController)
);

/**
 * @route GET /api/categorias/:id/tipos
 * @desc Buscar tipos de uma categoria
 * @access Private
 */
router.get('/:id/tipos', categoriasController.buscarTipos.bind(categoriasController));

/**
 * @route GET /api/categorias/mais-utilizadas
 * @desc Buscar categorias mais utilizadas
 * @access Private
 */
router.get('/stats/mais-utilizadas', categoriasController.maisUtilizadas.bind(categoriasController));

/**
 * @route POST /api/categorias/reordenar
 * @desc Reordenar categorias
 * @access Private - Requer nível gerente ou superior
 */
router.post('/actions/reordenar',
    requerNivel(3),
    categoriasController.reordenar.bind(categoriasController)
);

/**
 * @route GET /api/categorias/stats/estatisticas
 * @desc Obter estatísticas das categorias
 * @access Private
 */
router.get('/stats/estatisticas', categoriasController.estatisticas.bind(categoriasController));

/**
 * @route GET /api/categorias/stats/dashboard
 * @desc Dashboard de categorias
 * @access Private
 */
router.get('/stats/dashboard', categoriasController.dashboard.bind(categoriasController));

/**
 * @route GET /api/categorias/globais
 * @desc Buscar categorias globais (apenas admin sistema)
 * @access Private - Admin sistema apenas
 */
router.get('/admin/globais',
    requerNivel(1),
    categoriasController.globais.bind(categoriasController)
);

/**
 * @route POST /api/categorias/globais
 * @desc Criar categoria global (apenas admin sistema)
 * @access Private - Admin sistema apenas
 */
router.post('/admin/globais',
    requerNivel(1),
    categoriasController.criarGlobal.bind(categoriasController)
);

module.exports = router;