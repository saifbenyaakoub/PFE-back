const db = require('../../db');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/apiError');

// ─────────────────────────────────────────────────────────────────────────────
// GET /dashboard/stats/:userId?role=provider|client
// ─────────────────────────────────────────────────────────────────────────────
exports.getStats = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const { role } = req.query;

  if (!role) {
    return next(new ApiError('Le paramètre "role" est requis (provider | client)', 400));
  }

  if (role === 'provider') {
    // services.provider_id resolves through providers.id (separate from the
    // bookings table FK pattern below) — unaffected by this fix, left as-is.
    const providerRes = await db.query(
      'SELECT id FROM providers WHERE user_id = $1', [userId]
    );
    if (providerRes.rows.length === 0) {
      return next(new ApiError('Provider profile not found', 404));
    }
    const providerId = providerRes.rows[0].id;

    // bookings.provider_id references users.id directly (fk_provider), NOT
    // providers.id. These queries filter through services.provider_id
    // instead (via b.service_id -> services.provider_id = providerId), which
    // is a different, valid path — so they're correct as originally written.
    const earningsRes = await db.query(`
      SELECT COALESCE(SUM(b.amount), 0) AS total_earnings
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      WHERE s.provider_id = $1
        AND b.status = 'completed'
    `, [providerId]);

    const completedRes = await db.query(`
      SELECT COUNT(*) AS completed_jobs
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      WHERE s.provider_id = $1
        AND b.status = 'completed'
    `, [providerId]);

    const activeRes = await db.query(`
      SELECT COUNT(*) AS active_bookings
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      WHERE s.provider_id = $1
        AND b.status IN ('pending', 'confirmed', 'in-progress')
    `, [providerId]);

    const ratingRes = await db.query(`
      SELECT
        COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0) AS avg_rating,
        COUNT(r.id)::int AS total_reviews,
        COUNT(r.id) FILTER (WHERE r.rating = 5)::int AS five_star,
        COUNT(r.id) FILTER (WHERE r.rating = 4)::int AS four_star,
        COUNT(r.id) FILTER (WHERE r.rating = 3)::int AS three_star,
        COUNT(r.id) FILTER (WHERE r.rating = 2)::int AS two_star,
        COUNT(r.id) FILTER (WHERE r.rating = 1)::int AS one_star
      FROM reviews r
      JOIN bookings b ON b.id = r.booking_id
      LEFT JOIN services s ON s.id = b.service_id
      WHERE (s.provider_id = $1 OR b.provider_id = $1)
    `, [providerId]);

    return res.status(200).json({
      total_earnings:  parseFloat(earningsRes.rows[0].total_earnings),
      completed_jobs:  parseInt(completedRes.rows[0].completed_jobs),
      active_bookings: parseInt(activeRes.rows[0].active_bookings),
      avg_rating:      ratingRes.rows[0].avg_rating ?? null,
      total_reviews:   parseInt(ratingRes.rows[0].total_reviews),
    });
  }

  if (role === 'client') {
    // bookings.client_id references users.id directly (fk_client), NOT
    // clients.id — so filter directly against userId. The earlier clients.id
    // lookup was the bug causing "Total Spent" to always read 0: it filtered
    // bookings.client_id against clients.id, which never matches since that
    // column actually stores users.id.
    const spentRes = await db.query(`
      SELECT COALESCE(SUM(amount), 0) AS total_spent
      FROM bookings
      WHERE client_id = $1
        AND status = 'completed'
    `, [userId]);

    const completedRes = await db.query(`
      SELECT COUNT(*) AS completed_jobs
      FROM bookings
      WHERE client_id = $1
        AND status = 'completed'
    `, [userId]);

    const activeRes = await db.query(`
      SELECT COUNT(*) AS active_bookings
      FROM bookings
      WHERE client_id = $1
        AND status IN ('pending', 'confirmed', 'in-progress')
    `, [userId]);

    // reviews.client_id — left as clientId-based lookup since we have not
    // verified this FK; revisit if avg_rating_given turns out wrong too.
    const clientRes = await db.query(
      'SELECT id FROM clients WHERE user_id = $1', [userId]
    );
    const clientId = clientRes.rows[0]?.id ?? null;

    const ratingRes = clientId
      ? await db.query(`
          SELECT ROUND(AVG(rating)::numeric, 1) AS avg_rating_given
          FROM reviews
          WHERE client_id = $1
        `, [clientId])
      : { rows: [{ avg_rating_given: null }] };

    return res.status(200).json({
      total_spent:      parseFloat(spentRes.rows[0].total_spent),
      completed_jobs:   parseInt(completedRes.rows[0].completed_jobs),
      active_bookings:  parseInt(activeRes.rows[0].active_bookings),
      avg_rating_given: ratingRes.rows[0].avg_rating_given ?? null,
    });
  }

  return next(new ApiError('Rôle invalide. Utiliser "provider" ou "client"', 400));
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /dashboard/provider/:userId
// ─────────────────────────────────────────────────────────────────────────────
exports.getProviderDashboard = catchAsync(async (req, res, next) => {
  const { userId } = req.params;

  const providerRes = await db.query(
    'SELECT id FROM providers WHERE user_id = $1', [userId]
  );
  if (providerRes.rows.length === 0) {
    return next(new ApiError('Provider non trouvé', 404));
  }
  const providerId = providerRes.rows[0].id;

  const statsRes = await db.query(`
    SELECT
      COUNT(b.id)                                                      AS total_bookings,
      COUNT(b.id) FILTER (WHERE b.status = 'pending')                 AS pending_bookings,
      COUNT(b.id) FILTER (WHERE b.status = 'completed')               AS completed_jobs,
      COUNT(b.id) FILTER (WHERE b.status IN
        ('pending','confirmed','in-progress'))                         AS active_bookings,
      COALESCE(SUM(b.amount) FILTER (WHERE b.status = 'completed'),0)  AS total_earnings,
      (SELECT COUNT(*) FROM services WHERE provider_id = $1)          AS total_services,
      (SELECT ROUND(AVG(rating)::numeric,1)
       FROM reviews WHERE provider_id = $1)                           AS avg_rating,
      (SELECT COUNT(*) FROM reviews WHERE provider_id = $1)           AS total_reviews
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    WHERE s.provider_id = $1
  `, [providerId]);

  res.status(200).json({
    status: 'success',
    data: { stats: statsRes.rows[0] },
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /dashboard/provider/:userId/booking-requests
// ─────────────────────────────────────────────────────────────────────────────
exports.getBookingRequests = catchAsync(async (req, res, next) => {
  const { userId } = req.params;

  const providerRes = await db.query(
    'SELECT id FROM providers WHERE user_id = $1', [userId]
  );
  if (providerRes.rows.length === 0) {
    return next(new ApiError('Provider non trouvé', 404));
  }
  const providerId = providerRes.rows[0].id;

  // b.client_id is users.id directly, so join straight to users — no
  // intermediate clients table needed (previously joined via clients c,
  // which would break since b.client_id does not match clients.id).
  const bookingsRes = await db.query(`
    SELECT
      b.id,
      b.date,
      b.status,
      b.amount,
      COALESCE(s.title, 'Direct Booking') AS service_name,
      u.name                               AS client_name,
      u.profile_image                      AS client_image
    FROM bookings b
    LEFT JOIN services s ON b.service_id = s.id
    JOIN users    u ON u.id = b.client_id
    WHERE (s.provider_id = $1 OR b.provider_id = $1)
      AND b.status = 'pending'
    ORDER BY b.date ASC
  `, [providerId]);

  res.status(200).json({
    status:  'success',
    results: bookingsRes.rows.length,
    data:    bookingsRes.rows,
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /dashboard/provider/:userId/calendar-bookings
// ─────────────────────────────────────────────────────────────────────────────
exports.getCalendarBookings = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
 
  const providerRes = await db.query(
    'SELECT id FROM providers WHERE user_id = $1',
    [userId]
  );
  if (providerRes.rows.length === 0) {
    return next(new ApiError('Provider non trouvé', 404));
  }
  const providerId = providerRes.rows[0].id;
 
  // Same fix as getBookingRequests: b.client_id is users.id directly,
  // so join straight to users instead of through the clients table.
  const bookingsRes = await db.query(`
    SELECT DISTINCT
      b.id,
      b.date,
      b.status,
      b.amount,
      COALESCE(s.title, 'Direct Booking') AS service_name,
      u.name                              AS client_name,
      u.profile_image                     AS client_image
    FROM bookings b
    LEFT JOIN services s ON b.service_id = s.id
    LEFT JOIN users    u ON u.id = b.client_id
    WHERE s.provider_id = $1
       OR b.provider_id = $1
    ORDER BY b.date ASC
  `, [providerId]);
 
  console.log('[getCalendarBookings] providerId=' + providerId + ' rows=' + bookingsRes.rows.length);
 
  res.status(200).json({
    status: 'success',
    data:   bookingsRes.rows,
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// PUT /dashboard/bookings/:id/status  →  accept (confirm) a booking
// ─────────────────────────────────────────────────────────────────────────────
exports.acceptBooking = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const result = await db.query(
    "UPDATE bookings SET status = 'confirmed' WHERE id = $1 RETURNING *",
    [id]
  );

  if (result.rows.length === 0) {
    return next(new ApiError('Booking not found', 404));
  }

  res.status(200).json({ status: 'success', data: result.rows[0] });
});


// ─────────────────────────────────────────────────────────────────────────────
// DELETE /dashboard/bookings/:id  →  decline a booking (sets status=cancelled)
//
// FIX: previously hard-deleted the row, which made it vanish from the calendar.
//      Now we set status = 'cancelled' so the booking remains visible.
// ─────────────────────────────────────────────────────────────────────────────
exports.declineBooking = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const result = await db.query(
    "UPDATE bookings SET status = 'cancelled' WHERE id = $1 RETURNING *",
    [id]
  );

  if (result.rows.length === 0) {
    return next(new ApiError('Booking not found', 404));
  }

  res.status(200).json({ status: 'success', data: result.rows[0] });
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /dashboard/client/:userId
// ─────────────────────────────────────────────────────────────────────────────
exports.getClientDashboard = catchAsync(async (req, res, next) => {
  const { userId } = req.params;

  // Two different id conventions are in play here, confirmed via each
  // table's actual FK constraints:
  //   - bookings.client_id  -> users.id   (fk_client)
  //   - tasks.client_id     -> clients.id (tasks_client_id_fkey)
  // So bookings subqueries filter on userId directly, while tasks
  // subqueries need the resolved clientId below.
  const clientRes = await db.query(
    'SELECT id FROM clients WHERE user_id = $1', [userId]
  );
  const clientId = clientRes.rows[0]?.id ?? null;

  const statsRes = await db.query(`
    SELECT
      (SELECT COALESCE(SUM(amount), 0) FROM bookings WHERE client_id = $1 AND status = 'completed')           AS total_spent,
      (SELECT COUNT(*) FROM tasks    WHERE client_id = $2 AND status = 'completed')                           AS completed_jobs,
      (SELECT COUNT(*) FROM bookings WHERE client_id = $1 AND status IN ('pending', 'confirmed'))             AS active_bookings,
      (SELECT COUNT(*) FROM tasks    WHERE client_id = $2)                                                    AS total_posted_tasks
  `, [userId, clientId]);

  // tasks.status is now kept in sync directly by updateBookingStatus
  // (bookingsController.js) whenever a linked booking's status changes —
  // so booking_status is no longer needed here, t.status is the live value.
  // The booking is still joined for provider_name / has_reviewed.
  //
  // A task can have more than one booking row pointed at it over time
  // (e.g. a cancelled attempt followed by a real one), and a plain
  // LEFT JOIN bookings b ON b.task_id = t.id returns one row PER MATCHING
  // BOOKING — duplicating the task in the result set (this was the cause
  // of "two children with the same key" on the frontend). The LATERAL
  // join below picks only the single most recent booking per task instead.
  const tasksRes = await db.query(`
  SELECT
    t.id,
    t.title,
    t.category,
    t.created_at       AS date,
    t.status,
    t.image_url        AS image,
    b.id               AS booking_id,
    u.name             AS provider_name,
    (SELECT COUNT(*) FROM reviews WHERE booking_id = b.id)::int > 0 AS has_reviewed
  FROM tasks t
  LEFT JOIN LATERAL (
    SELECT * FROM bookings
    WHERE task_id = t.id
    ORDER BY created_at DESC
    LIMIT 1
  ) b ON true
  LEFT JOIN providers prov ON b.provider_id = prov.id
  LEFT JOIN users     u    ON prov.user_id  = u.id
  WHERE t.client_id = $1
  ORDER BY t.created_at DESC
`, [clientId]);

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });

  const tasks = tasksRes.rows.map(task => ({
  ...task,
  date:         formatDate(task.date),
  image:        task.image || null,
  // t.status is now the live, synced value (kept up to date by
  // updateBookingStatus whenever a linked booking changes status), so it's
  // used directly here. Kept as `bookingStatus` so TaskCard.jsx's existing
  // `task.bookingStatus ?? "open"` logic continues to work unchanged.
  bookingStatus: task.status ?? null,
}));

  res.status(200).json({
    status: 'success',
    data: {
      stats: {
        totalSpent:    parseFloat(statsRes.rows[0]?.total_spent    || 0),
        completedJobs: parseInt(statsRes.rows[0]?.completed_jobs   || 0),
        activeBookings:parseInt(statsRes.rows[0]?.active_bookings  || 0),
        postedTasks:   parseInt(statsRes.rows[0]?.total_posted_tasks || 0),
      },
      appliedTasks: tasks,
    },
  });
});