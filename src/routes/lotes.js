const express = require('express');
const lotesController = require('../controllers/lotesController');
const { autenticacao, requerPermissao } = require('../middlewares/authorizationMiddleware');

const router = express.Router();

// Aplicar autenticação em todas as rotas
router.use(autenticacao);

/**
 * @route GET /api/lotes
 * @desc Listar lotes com filtros e paginação
 * @access Private
 */
router.get('/',
    requerPermissao('lotes', 'visualizar'),
    lotesController.listar.bind(lotesController)
);

/**
 * @route GET /api/lotes/:id
 * @desc Buscar lote por ID
 * @access Private
 */
router.get('/:id',
    requerPermissao('lotes', 'visualizar'),
    lotesController.buscarPorId.bind(lotesController)
);

/**
 * @route POST /api/lotes
 * @desc Criar novo lote
 * @access Private
 */
router.post('/',
    requerPermissao('lotes', 'criar'),
    lotesController.criar.bind(lotesController)
);

/**
 * @route PUT /api/lotes/:id
 * @desc Atualizar lote
 * @access Private
 */
router.put('/:id',
    requerPermissao('lotes', 'editar'),
    lotesController.atualizar.bind(lotesController)
);

/**
 * @route DELETE /api/lotes/:id
 * @desc Excluir lote (soft delete)
 * @access Private
 */
router.delete('/:id',
    requerPermissao('lotes', 'excluir'),
    lotesController.excluir.bind(lotesController)
);

/**
 * @route GET /api/lotes/produto/:produto_id
 * @desc Buscar lotes por produto
 * @access Private
 */
router.get('/produto/:produto_id',
    requerPermissao('lotes', 'visualizar'),
    lotesController.porProduto.bind(lotesController)
);

/**
 * @route GET /api/lotes/vencimento/proximos
 * @desc Buscar lotes próximos do vencimento
 * @access Private
 */
router.get('/vencimento/proximos',
    requerPermissao('lotes', 'visualizar'),
    lotesController.proximosVencimento.bind(lotesController)
);

/**
 * @route GET /api/lotes/vencimento/vencidos-com-estoque
 * @desc Buscar lotes vencidos com estoque
 * @access Private
 */
router.get('/vencimento/vencidos-com-estoque',
    requerPermissao('lotes', 'visualizar'),
    lotesController.vencidosComEstoque.bind(lotesController)
);

/**
 * @route GET /api/lotes/:id/historico-movimentacoes
 * @desc Obter histórico de movimentações do lote
 * @access Private
 */
router.get('/:id/historico-movimentacoes',
    requerPermissao('lotes', 'visualizar'),
    lotesController.historicoMovimentacoes.bind(lotesController)
);

/**
 * @route GET /api/lotes/:id/estoque-por-setor
 * @desc Obter estoque do lote por setor
 * @access Private
 */
router.get('/:id/estoque-por-setor',
    requerPermissao('lotes', 'visualizar'),
    lotesController.estoquePorSetor.bind(lotesController)
);

/**
 * @route GET /api/lotes/:id/estatisticas
 * @desc Obter estatísticas do lote
 * @access Private
 */
router.get('/:id/estatisticas',
    requerPermissao('lotes', 'visualizar'),
    lotesController.estatisticas.bind(lotesController)
);

/**
 * @route PUT /api/lotes/:id/marcar-consumido
 * @desc Marcar lote como consumido
 * @access Private
 */
router.put('/:id/marcar-consumido',
    requerPermissao('lotes', 'editar'),
    lotesController.marcarConsumido.bind(lotesController)
);

module.exports = router; 