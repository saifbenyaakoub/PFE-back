const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/servicesController');
const { authenticateToken } = require('../middleware/authMiddleware');

// GET /services — tous les services actifs
router.get('/', ctrl.getAllServices);

// GET /services/category/:category — filtre par catégorie
router.get('/category/:category', ctrl.getByCategory);

// GET /services/provider/:userId — services d'un prestataire (pour son profil public)
router.get('/provider/:userId', ctrl.getProviderServices);

router.get('/:id', ctrl.getServiceById);
// POST /services — créer un service (provider uniquement)
router.post('/', authenticateToken, ctrl.createService);

// PUT /services/:id — modifier un service
router.put('/:id', authenticateToken, ctrl.updateService);

// PATCH /services/:id/toggle — activer / désactiver
router.patch('/:id/toggle', authenticateToken, ctrl.toggleService);

// DELETE /services/:id — supprimer (bloqué si bookings actifs)
router.delete('/:id', authenticateToken, ctrl.deleteService);

module.exports = router;