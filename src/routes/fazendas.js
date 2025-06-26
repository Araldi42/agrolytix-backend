/**
 * Rotas para Fazendas
 * Gerencia propriedades/unidades da empresa
 */

const express = require('express');
const router = express.Router();
const FazendasController = require('../controllers/fazendasController');
const { autenticacao } = require('../middlewares/autenticacao');
const { requerNivel } = require('../middlewares/authorizationMiddleware');

const fazendasController = new FazendasController();

/**
 * @route GET /api/fazendas/estatisticas
 * @desc Buscar fazendas com estatísticas
 * @access Private (Admin, Gerente) - Níveis 1, 2, 3
 */
router.get('/estatisticas', 
    autenticacao, 
    requerNivel(3), // Admin sistema (1), Admin empresa (2), Gerente (3)
    (req, res, next) => fazendasController.comEstatisticas(req, res, next)
);

/**
 * @route GET /api/fazendas/proximas
 * @desc Buscar fazendas próximas por geolocalização
 * @access Private (Admin, Gerente, Operador) - Níveis 1, 2, 3, 4
 */
router.get('/proximas', 
    autenticacao, 
    requerNivel(4), // Admin sistema (1), Admin empresa (2), Gerente (3), Operador (4)
    (req, res, next) => fazendasController.proximasPorLocalizacao(req, res, next)
);

/**
 * @route GET /api/fazendas
 * @desc Listar fazendas da empresa
 * @access Private (Admin, Gerente, Operador) - Níveis 1, 2, 3, 4
 */
router.get('/', 
    autenticacao, 
    requerNivel(4), // Admin sistema (1), Admin empresa (2), Gerente (3), Operador (4)
    (req, res, next) => fazendasController.listar(req, res, next)
);

/**
 * @route GET /api/fazendas/:id
 * @desc Buscar fazenda por ID com detalhes
 * @access Private (Admin, Gerente, Operador) - Níveis 1, 2, 3, 4
 */
router.get('/:id', 
    autenticacao, 
    requerNivel(4), // Admin sistema (1), Admin empresa (2), Gerente (3), Operador (4)
    (req, res, next) => fazendasController.buscarPorId(req, res, next)
);

/**
 * @route POST /api/fazendas
 * @desc Criar nova fazenda
 * @access Private (Admin, Gerente) - Níveis 1, 2, 3
 */
router.post('/', 
    autenticacao, 
    requerNivel(3), // Admin sistema (1), Admin empresa (2), Gerente (3)
    (req, res, next) => fazendasController.criar(req, res, next)
);

/**
 * @route PUT /api/fazendas/:id
 * @desc Atualizar fazenda existente
 * @access Private (Admin, Gerente) - Níveis 1, 2, 3
 */
router.put('/:id', 
    autenticacao, 
    requerNivel(3), // Admin sistema (1), Admin empresa (2), Gerente (3)
    (req, res, next) => fazendasController.atualizar(req, res, next)
);

/**
 * @route DELETE /api/fazendas/:id
 * @desc Excluir fazenda
 * @access Private (Admin) - Níveis 1, 2
 */
router.delete('/:id', 
    autenticacao, 
    requerNivel(2), // Admin sistema (1), Admin empresa (2)
    (req, res, next) => fazendasController.excluir(req, res, next)
);

/**
 * @route GET /api/fazendas/:id/setores
 * @desc Buscar setores de uma fazenda
 * @access Private (Admin, Gerente, Operador) - Níveis 1, 2, 3, 4
 */
router.get('/:id/setores', 
    autenticacao, 
    requerNivel(4), // Admin sistema (1), Admin empresa (2), Gerente (3), Operador (4)
    (req, res, next) => fazendasController.setores(req, res, next)
);

/**
 * @route GET /api/fazendas/:id/produtos
 * @desc Buscar produtos de uma fazenda
 * @access Private (Admin, Gerente, Operador) - Níveis 1, 2, 3, 4
 */
router.get('/:id/produtos', 
    autenticacao, 
    requerNivel(4), // Admin sistema (1), Admin empresa (2), Gerente (3), Operador (4)
    (req, res, next) => fazendasController.produtos(req, res, next)
);

/**
 * @route GET /api/fazendas/:id/safras
 * @desc Buscar safras de uma fazenda
 * @access Private (Admin, Gerente, Operador) - Níveis 1, 2, 3, 4
 */
router.get('/:id/safras', 
    autenticacao, 
    requerNivel(4), // Admin sistema (1), Admin empresa (2), Gerente (3), Operador (4)
    (req, res, next) => fazendasController.safras(req, res, next)
);

/**
 * @route GET /api/fazendas/:id/resumo-financeiro
 * @desc Obter resumo financeiro da fazenda
 * @access Private (Admin, Gerente) - Níveis 1, 2, 3
 */
router.get('/:id/resumo-financeiro', 
    autenticacao, 
    requerNivel(3), // Admin sistema (1), Admin empresa (2), Gerente (3)
    (req, res, next) => fazendasController.resumoFinanceiro(req, res, next)
);

/**
 * @route GET /api/fazendas/:id/capacidade-armazenamento
 * @desc Obter capacidade de armazenamento da fazenda
 * @access Private (Admin, Gerente, Operador) - Níveis 1, 2, 3, 4
 */
router.get('/:id/capacidade-armazenamento', 
    autenticacao, 
    requerNivel(4), // Admin sistema (1), Admin empresa (2), Gerente (3), Operador (4)
    (req, res, next) => fazendasController.capacidadeArmazenamento(req, res, next)
);

/**
 * @route GET /api/fazendas/:id/dashboard
 * @desc Dashboard da fazenda
 * @access Private (Admin, Gerente, Operador) - Níveis 1, 2, 3, 4
 */
router.get('/:id/dashboard', 
    autenticacao, 
    requerNivel(4), // Admin sistema (1), Admin empresa (2), Gerente (3), Operador (4)
    (req, res, next) => fazendasController.dashboard(req, res, next)
);

module.exports = router; 