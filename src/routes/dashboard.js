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

router.get('/provider/:userId/booking-requests', ctrl.getBookingRequests);

// Dans routes/dashboard.js
router.put('/bookings/:id/status', authenticateToken, ctrl.acceptBooking);
router.delete('/bookings/:id', authenticateToken, ctrl.declineBooking);

// GET /dashboard/client/:userId
router.get('/client/:userId', ctrl.getClientDashboard);

module.exports = router;