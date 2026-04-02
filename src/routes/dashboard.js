const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);


// Utilisée par ProviderDashboard et ClientDashboard pour les KPI cards
router.get('/stats/:userId', ctrl.getStats);

// ── Routes complètes (stats + bookings récents) ───────────────────────────────
// GET /dashboard/provider/:userId
router.get('/provider/:userId', ctrl.getProviderDashboard);

// GET /dashboard/client/:userId
router.get('/client/:userId', ctrl.getClientDashboard);

module.exports = router;