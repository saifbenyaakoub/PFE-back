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
// HELPER — determine if a given booking is the "active" booking for its task.
//
// A task can end up with more than one non-cancelled booking — e.g. two
// different providers were both accepted on the same task. That's a data
// integrity issue on its own (see note in updateBookingStatus below), but
// regardless of *why* it happened, the status-sync code must not let an
// older/stale booking overwrite a task that's already moved on under a
// different, more recent booking. Only the most recent non-cancelled
// booking for a task is allowed to drive that task's status.
// ─────────────────────────────────────────────────────────────────────────────
const isActiveBookingForTask = async (bookingId, taskId) => {
  if (!taskId) return false;
  const { rows } = await db.query(
    `SELECT id FROM bookings
     WHERE task_id = $1 AND status != 'cancelled'
     ORDER BY id DESC LIMIT 1`,
    [taskId]
  );
  return rows[0]?.id === Number(bookingId);
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

  // NOTE: bookings.client_id references users.id directly (fk_client),
  // not clients.id — joining through `clients c` here was the same
  // id-mismatch bug found elsewhere in the app. Fixed to join users directly.
  const { rows } = await db.query(`
SELECT
    b.id,
    b.date,
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
JOIN users u_client   ON u_client.id = b.client_id
JOIN services s       ON s.id        = b.service_id
WHERE s.provider_id = $1
AND b.status != 'pending'
ORDER BY b.date ASC;
  `, [providerId]);

  res.status(200).json(rows);
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /bookings/client/:userId
//
// Tous les bookings d'un client avec infos prestataire.
// Utilisé par le dashboard client.
// ─────────────────────────────────────────────────────────────────────────────
exports.getClientBookings = catchAsync(async (req, res, next) => {
  const { userId } = req.params;

  // bookings.client_id references users.id directly — filter on userId,
  // no clients table lookup needed here.
  const { rows } = await db.query(`
    SELECT
      b.id,
      b.date,
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
  `, [userId]);

  res.status(200).json(rows);
});


// ─────────────────────────────────────────────────────────────────────────────
// PUT /bookings/:id/status
//
// Changer le statut d'un booking.
// Utilisé par :
//   - Le prestataire (Accept → confirmed, mark as completed, etc.)
//   - Le calendrier (select dropdown inline / drag-to-status progress bar)
// Body : { status: "confirmed" | "in-progress" | "completed" | "cancelled" }
//
// Whenever a booking's status changes, if that booking is linked to a task
// (bookings.task_id), the task's own status column is updated using a mapping
// because booking statuses and task statuses use different enum values:
//
//   Booking status  →  Task status
//   ─────────────────────────────
//   confirmed       →  in_progress   (task is now being handled)
//   in-progress     →  in_progress   (hyphen → underscore)
//   completed       →  completed
//   cancelled       →  cancelled
//
// IMPORTANT — multiple bookings per task:
// A task can end up with more than one non-cancelled booking (e.g. two
// providers were both accepted on the same task — this is a data
// integrity bug that should be fixed at booking-creation time, by
// rejecting new bookings against a task that already has an active one).
// Until that's fixed at the source, this code guards against the
// *symptom*: updating an old/stale booking's status must never overwrite
// the linked task if that booking is no longer the active one. We only
// sync tasks.status when this booking is the most recent non-cancelled
// booking for its task.
// ─────────────────────────────────────────────────────────────────────────────
exports.updateBookingStatus = catchAsync(async (req, res, next) => {
  const { id }     = req.params;
  const { status } = req.body;

  const ALLOWED = ['confirmed', 'in-progress', 'completed', 'cancelled'];
  if (!ALLOWED.includes(status)) {
    return next(new ApiError(`Statut invalide. Valeurs acceptées : ${ALLOWED.join(', ')}`, 400));
  }

  // Vérifier que le booking existe
  const check = await db.query('SELECT id, task_id FROM bookings WHERE id = $1', [id]);
  if (check.rows.length === 0) {
    return next(new ApiError('Booking introuvable', 404));
  }
  const taskId = check.rows[0].task_id;

  const { rows } = await db.query(`
    UPDATE bookings
    SET    status     = $1
    WHERE  id         = $2
    RETURNING 
      id, date, amount, status, task_id, created_at
  `, [status, id]);

  // Sync the linked task's status using an explicit mapping — but only if
  // this booking is still the active (most recent, non-cancelled) one for
  // its task. See note above.
  if (taskId && await isActiveBookingForTask(id, taskId)) {
    // tasks.status CHECK constraint only allows:
    //   'open' | 'in_progress' | 'completed' | 'cancelled'
    // which differs from booking statuses, so we cannot write the booking
    // status value directly into tasks.status.
    const BOOKING_TO_TASK_STATUS = {
      'confirmed':   'in_progress',  // task is now assigned/being handled
      'in-progress': 'in_progress',  // hyphen (booking) → underscore (task)
      'completed':   'completed',
      'cancelled':   'cancelled',
    };

    const taskStatus = BOOKING_TO_TASK_STATUS[status];
    if (taskStatus) {
      await db.query(
        `UPDATE tasks SET status = $1 WHERE id = $2`,
        [taskStatus, taskId]
      );
    }
  }

  res.status(200).json({
    status:  'success',
    message: `Booking mis à jour : ${status}`,
    data:    rows[0],
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// DELETE /bookings/:id/cancel
//
// Cancel an ACTIVE booking (confirmed or in-progress) — distinct from
// deleteBooking above, which only handles declining a still-pending request.
// Either the client or the provider on this booking may cancel it.
// Not allowed once the booking is already 'completed'.
//
// If the booking is linked to a task (task_id), that task's status is reset
// back to 'open' so it becomes available to book again, since the booking
// that was fulfilling it no longer exists — but only if this booking was
// the active one for that task (see isActiveBookingForTask above). If an
// older, already-superseded booking gets cancelled, it must not reset a
// task that's since moved on under a newer booking.
// ─────────────────────────────────────────────────────────────────────────────
exports.cancelActiveBooking = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const requesterId = req.user.id; // users.id, set by authenticateToken

  const check = await db.query(
    'SELECT id, client_id, provider_id, status, task_id FROM bookings WHERE id = $1',
    [id]
  );
  if (check.rows.length === 0) {
    return next(new ApiError('Booking introuvable', 404));
  }
  const booking = check.rows[0];

  // bookings.client_id / provider_id are users.id directly (see fk_client /
  // fk_provider) — compare straight against the requester's id, no lookup
  // through clients/providers tables needed.
  const isOwner = Number(booking.client_id) === Number(requesterId)
    || Number(booking.provider_id) === Number(requesterId);
  if (!isOwner) {
    return next(new ApiError("Vous n'êtes pas autorisé à annuler cette réservation", 403));
  }

  if (booking.status === 'completed') {
    return next(new ApiError('Impossible d\'annuler une réservation déjà terminée', 400));
  }
  if (!['confirmed', 'in-progress'].includes(booking.status)) {
    return next(new ApiError(
      `Cette réservation ne peut pas être annulée depuis son statut actuel (${booking.status})`,
      400
    ));
  }

  // Check active status BEFORE deleting, since removing this booking
  // changes what counts as "active" for the task afterwards.
  const wasActive = booking.task_id
    ? await isActiveBookingForTask(id, booking.task_id)
    : false;

  await db.query('DELETE FROM bookings WHERE id = $1', [id]);

  if (booking.task_id && wasActive) {
    await db.query(`UPDATE tasks SET status = 'open' WHERE id = $1`, [booking.task_id]);
  }

  res.status(200).json({
    status:  'success',
    message: 'Réservation annulée',
  });
});



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