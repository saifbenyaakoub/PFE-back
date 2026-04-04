const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/bookingsController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Toutes les routes nécessitent un token valide
router.use(authenticateToken);

// ── Provider ──────────────────────────────────────────────────────────────────

// GET /bookings/provider/:userId
// → Tous les bookings du prestataire (utilisé par le calendrier + overview)
router.get('/provider/:userId', ctrl.getProviderBookings);

// ── Client ────────────────────────────────────────────────────────────────────

// GET /bookings/client/:userId
// → Tous les bookings d'un client
router.get('/client/:userId', ctrl.getClientBookings);

// ── Actions sur un booking ────────────────────────────────────────────────────

// PUT /bookings/:id/status
// → Changer le statut (confirmed, in-progress, completed, cancelled)
router.patch('/:id/status', ctrl.updateBookingStatus);

// DELETE /bookings/:id
// → Décliner / supprimer un booking (prestataire refuse)
router.delete('/:id', ctrl.deleteBooking);

module.exports = router;