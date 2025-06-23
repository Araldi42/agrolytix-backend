const express = require('express');
const produtosController = require('../controllers/produtosController');
const { autenticacao, requerPermissao } = require('../middlewares/authorizationMiddleware');

const router = express.Router();

// Aplicar autenticação em todas as rotas
router.use(autenticacao);

/**
 * @route GET /api/produtos
 * @desc Listar produtos com filtros e paginação
 * @access Private
 */
router.get('/',
    requerPermissao('produtos', 'visualizar'),
    produtosController.listar
);

/**
 * @route GET /api/produtos/:id
 * @desc Buscar produto por ID
 * @access Private
 */
router.get('/:id',
    requerPermissao('produtos', 'visualizar'),
    produtosController.buscarPorId
);

/**
 * @route POST /api/produtos
 * @desc Criar novo produto
 * @access Private
 */
router.post('/',
    requerPermissao('produtos', 'criar'),
    produtosController.criar
);

/**
 * @route PUT /api/produtos/:id
 * @desc Atualizar produto
 * @access Private
 */
router.put('/:id',
    requerPermissao('produtos', 'editar'),
    produtosController.atualizar
);

/**
 * @route DELETE /api/produtos/:id
 * @desc Excluir produto (soft delete)
 * @access Private
 */
router.delete('/:id',
    requerPermissao('produtos', 'excluir'),
    produtosController.excluir
);

/**
 * @route GET /api/produtos/stats/estoque-baixo
 * @desc Buscar produtos com estoque baixo
 * @access Private
 */
router.get('/stats/estoque-baixo',
    requerPermissao('produtos', 'visualizar'),
    produtosController.estoqueBaixo
);

/**
 * @route GET /api/produtos/stats/estatisticas
 * @desc Obter estatísticas dos produtos
 * @access Private
 */
router.get('/stats/estatisticas',
    requerPermissao('produtos', 'visualizar'),
    produtosController.estatisticas
);

/**
 * @route GET /api/produtos/manutencao/para-manutencao
 * @desc Buscar produtos para manutenção
 * @access Private
 */
router.get('/manutencao/para-manutencao',
    requerPermissao('produtos', 'visualizar'),
    produtosController.paraManutencao
);

/**
 * @route PUT /api/produtos/actions/status-batch
 * @desc Atualizar status de múltiplos produtos
 * @access Private
 */
router.put('/actions/status-batch',
    requerPermissao('produtos', 'editar'),
    produtosController.atualizarStatusBatch
);

/**
 * @route GET /api/produtos/fornecedor/:fornecedor_id
 * @desc Buscar produtos por fornecedor
 * @access Private
 */
router.get('/fornecedor/:fornecedor_id',
    requerPermissao('produtos', 'visualizar'),
    produtosController.porFornecedor
);

/**
 * @route GET /api/produtos/relatorios/geral
 * @desc Gerar relatório de produtos
 * @access Private
 */
router.get('/relatorios/geral',
    requerPermissao('produtos', 'visualizar'),
    produtosController.relatorio
);

module.exports = router;