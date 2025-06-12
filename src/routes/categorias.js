const express = require('express');
const categoriasController = require('../controllers/categoriasController');
const { autenticacao } = require('../middlewares/autenticacao');

const router = express.Router();

// Aplicar middleware de autenticação em todas as rotas
router.use(autenticacao);

/**
 * @route GET /api/categorias
 * @desc Buscar todas as categorias
 * @access Private
 */
router.get('/', categoriasController.buscarTodas);

/**
 * @route GET /api/categorias/:id
 * @desc Buscar categoria por ID
 * @access Private
 */
router.get('/:id', categoriasController.buscarPorId);

/**
 * @route POST /api/categorias
 * @desc Criar nova categoria
 * @access Private
 */
router.post('/', categoriasController.criar);

/**
 * @route PUT /api/categorias/:id
 * @desc Atualizar categoria
 * @access Private
 */
router.put('/:id', categoriasController.atualizar);

/**
 * @route DELETE /api/categorias/:id
 * @desc Excluir categoria
 * @access Private
 */
router.delete('/:id', categoriasController.excluir);

/**
 * @route GET /api/categorias/:id/tipos
 * @desc Buscar tipos de uma categoria
 * @access Private
 */
router.get('/:id/tipos', categoriasController.buscarTipos);

module.exports = router;