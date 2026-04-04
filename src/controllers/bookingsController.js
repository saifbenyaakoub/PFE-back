const db         = require('../../db');
const catchAsync = require('../utils/catchAsync');
const ApiError   = require('../utils/apiError');

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — résoudre provider_id depuis user_id
// ─────────────────────────────────────────────────────────────────────────────
const getProviderId = async (userId) => {
  const res = await db.query(
    'SELECT id FROM providers WHERE user_id = $1', [userId]
  );
  return res.rows[0]?.id ?? null;
};

const getClientId = async (userId) => {
  const res = await db.query(
    'SELECT id FROM clients WHERE user_id = $1', [userId]
  );
  return res.rows[0]?.id ?? null;
};


// ─────────────────────────────────────────────────────────────────────────────
// GET /bookings/provider/:userId
//
// Tous les bookings du prestataire avec toutes les infos nécessaires
// pour le CALENDRIER et l'OVERVIEW.
//
// Champs retournés (attendus par le frontend) :
//   id, date, time, city, amount, status,
//   client_name, client_image,
//   service_name
// ─────────────────────────────────────────────────────────────────────────────
exports.getProviderBookings = catchAsync(async (req, res, next) => {
  const { userId } = req.params;

  const providerId = await getProviderId(userId);
  if (!providerId) {
    return next(new ApiError('Profil prestataire introuvable', 404));
  }

  const { rows } = await db.query(`
SELECT
    b.id,
    b.date,
    b.time,
    c.city,
    b.amount,
    b.status,
    b.created_at,
    u_client.name          AS client_name,
    u_client.profile_image AS client_image,
    u_client.email         AS client_email,
    s.title                AS service_name,
    s.category             AS service_category,
    s.description          AS service_description
FROM bookings b
JOIN clients c        ON c.id        = b.client_id
JOIN users u_client   ON u_client.id = c.user_id
JOIN services s       ON s.id        = b.service_id
WHERE s.provider_id = $1
AND b.status != 'pending'
ORDER BY b.date ASC, b.time ASC;
  `, [providerId]);

  res.status(200).json(rows);
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /bookings/provider/:userId/requests
//
// Uniquement les bookings en statut "pending" — section Booking Requests
// dans l'Overview du dashboard.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// GET /bookings/client/:userId
//
// Tous les bookings d'un client avec infos prestataire.
// Utilisé par le dashboard client.
// ─────────────────────────────────────────────────────────────────────────────
exports.getClientBookings = catchAsync(async (req, res, next) => {
  const { userId } = req.params;

  const clientId = await getClientId(userId);
  if (!clientId) {
    return next(new ApiError('Profil client introuvable', 404));
  }

  const { rows } = await db.query(`
    SELECT
      b.id,
      b.date,
      b.time,
      b.city,
      b.amount,
      b.status,
      b.created_at,
      u_provider.name          AS provider_name,
      u_provider.profile_image AS provider_image,
      s.title                  AS service_name,
      s.category               AS service_category
    FROM bookings b
    JOIN services  s          ON s.id         = b.service_id
    JOIN providers p          ON p.id         = s.provider_id
    JOIN users     u_provider ON u_provider.id = p.user_id
    WHERE b.client_id = $1
    ORDER BY b.date DESC
  `, [clientId]);

  res.status(200).json(rows);
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /bookings
//
// Le client crée une nouvelle réservation.
// Body : { service_id, date, time, city, amount }
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// PUT /bookings/:id/status
//
// Changer le statut d'un booking.
// Utilisé par :
//   - Le prestataire (Accept → confirmed, mark as completed, etc.)
//   - Le calendrier (select dropdown inline)
// Body : { status: "confirmed" | "in-progress" | "completed" | "cancelled" }
// ─────────────────────────────────────────────────────────────────────────────
exports.updateBookingStatus = catchAsync(async (req, res, next) => {
  const { id }     = req.params;
  const { status } = req.body;

  const ALLOWED = ['confirmed', 'completed', 'cancelled'];
  if (!ALLOWED.includes(status)) {
    return next(new ApiError(`Statut invalide. Valeurs acceptées : ${ALLOWED.join(', ')}`, 400));
  }

  // Vérifier que le booking existe
  const check = await db.query('SELECT id FROM bookings WHERE id = $1', [id]);
  if (check.rows.length === 0) {
    return next(new ApiError('Booking introuvable', 404));
  }

const { rows } = await db.query(`
    UPDATE bookings
    SET    status     = $1
    WHERE  id         = $2
    RETURNING 
      id, date, time, amount, status, created_at
  `, [status, id]);

  res.status(200).json({
    status:  'success',
    message: `Booking mis à jour : ${status}`,
    data:    rows[0],
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// DELETE /bookings/:id
//
// Décliner / supprimer un booking.
// Utilisé quand le prestataire clique "Decline" sur un booking pending.
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteBooking = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Vérifier que le booking est bien pending (on ne supprime pas un booking accepté)
  const check = await db.query(
    'SELECT id, status FROM bookings WHERE id = $1', [id]
  );
  if (check.rows.length === 0) {
    return next(new ApiError('Booking introuvable', 404));
  }

  if (check.rows[0].status !== 'pending') {
    return next(new ApiError(
      'Seuls les bookings en attente peuvent être déclinés. Pour annuler un booking confirmé, utilisez le changement de statut.',
      400
    ));
  }

  await db.query('DELETE FROM bookings WHERE id = $1', [id]);

  res.status(200).json({
    status:  'success',
    message: 'Booking décliné et supprimé',
  });
});