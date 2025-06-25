const express = require('express');
const movimentacoesController = require('../controllers/movimentacoesController');
const { autenticacao, requerPermissao } = require('../middlewares/authorizationMiddleware');

const router = express.Router();

// Aplicar autenticação em todas as rotas
router.use(autenticacao);

/**
 * @route GET /api/movimentacoes
 * @desc Listar movimentações com filtros e paginação
 * @access Private
 */
router.get('/',
    requerPermissao('movimentacoes', 'visualizar'),
    movimentacoesController.listar.bind(movimentacoesController)
);

/**
 * @route GET /api/movimentacoes/:id
 * @desc Buscar movimentação por ID
 * @access Private
 */
router.get('/:id',
    requerPermissao('movimentacoes', 'visualizar'),
    movimentacoesController.buscarPorId.bind(movimentacoesController)
);

/**
 * @route POST /api/movimentacoes
 * @desc Criar nova movimentação
 * @access Private
 */
router.post('/',
    requerPermissao('movimentacoes', 'criar'),
    movimentacoesController.criar.bind(movimentacoesController)
);

/**
 * @route PUT /api/movimentacoes/:id/aprovar
 * @desc Aprovar movimentação pendente
 * @access Private
 */
router.put('/:id/aprovar',
    requerPermissao('movimentacoes', 'aprovar'),
    movimentacoesController.aprovar.bind(movimentacoesController)
);

/**
 * @route PUT /api/movimentacoes/:id/cancelar
 * @desc Cancelar movimentação
 * @access Private
 */
router.put('/:id/cancelar',
    requerPermissao('movimentacoes', 'cancelar'),
    movimentacoesController.cancelar.bind(movimentacoesController)
);

/**
 * @route GET /api/movimentacoes/periodo
 * @desc Buscar movimentações por período
 * @access Private
 */
router.get('/filters/periodo',
    requerPermissao('movimentacoes', 'visualizar'),
    movimentacoesController.porPeriodo.bind(movimentacoesController)
);

/**
 * @route GET /api/movimentacoes/stats/estatisticas
 * @desc Obter estatísticas de movimentações
 * @access Private
 */
router.get('/stats/estatisticas',
    requerPermissao('movimentacoes', 'visualizar'),
    movimentacoesController.estatisticas.bind(movimentacoesController)
);

/**
 * @route GET /api/movimentacoes/approval/pendentes
 * @desc Buscar movimentações pendentes de aprovação
 * @access Private
 */
router.get('/approval/pendentes',
    requerPermissao('movimentacoes', 'aprovar'),
    movimentacoesController.pendentesAprovacao.bind(movimentacoesController)
);

/**
 * @route GET /api/movimentacoes/stats/produtos-mais-movimentados
 * @desc Buscar produtos mais movimentados
 * @access Private
 */
router.get('/stats/produtos-mais-movimentados',
    requerPermissao('movimentacoes', 'visualizar'),
    movimentacoesController.produtosMaisMovimentados.bind(movimentacoesController)
);

/**
 * @route GET /api/movimentacoes/relatorios/periodo
 * @desc Gerar relatório de movimentações
 * @access Private
 */
router.get('/relatorios/periodo',
    requerPermissao('movimentacoes', 'visualizar'),
    movimentacoesController.relatorio.bind(movimentacoesController)
);

module.exports = router;