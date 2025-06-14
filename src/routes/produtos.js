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

module.exports = router; 