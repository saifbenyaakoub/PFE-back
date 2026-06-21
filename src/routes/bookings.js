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

// DELETE /bookings/:id/cancel
// → Le client OU le prestataire annule une réservation active
//   (confirmed / in-progress). Bloqué si déjà 'completed'.
//   Distinct de DELETE /:id ci-dessous, qui ne gère que le refus
//   d'une demande encore 'pending'.
router.delete('/:id/cancel', ctrl.cancelActiveBooking);

// DELETE /bookings/:id
// → Décliner / supprimer un booking (prestataire refuse une demande pending)
router.delete('/:id', ctrl.deleteBooking);

module.exports = router;