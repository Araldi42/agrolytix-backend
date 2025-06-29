// ===================================================================
// ROUTE - dashboard.js (src/routes/dashboard.js)
// ===================================================================

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { autenticacao, requerNivel } = require('../middlewares/authorizationMiddleware');

/**
 * @route GET /api/dashboard
 * @desc Obter dados completos do dashboard
 * @access Admin Sistema, Admin Empresa, Gerente
 * @query fazenda_id (opcional) - ID da fazenda específica
 */
router.get('/',
    autenticacao,
    requerNivel(3), // Níveis 1, 2 e 3 podem acessar (Admin Sistema, Admin Empresa, Gerente)
    dashboardController.obterDashboard
);

/**
 * @route GET /api/dashboard/resumo
 * @desc Obter resumo rápido do dashboard (para atualizações)
 * @access Admin Sistema, Admin Empresa, Gerente
 * @query fazenda_id (opcional) - ID da fazenda específica
 */
router.get('/resumo',
    autenticacao,
    requerNivel(3), // Níveis 1, 2 e 3 podem acessar
    dashboardController.obterResumoRapido
);

module.exports = router;