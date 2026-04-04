const db = require('../../db');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/apiError');

// ─────────────────────────────────────────────────────────────────────────────
// GET /dashboard/stats/:userId?role=provider|client
//
// Appelé par le frontend ProviderDashboard et ClientDashboard au montage.
// Retourne les KPI cards selon le rôle.
// ─────────────────────────────────────────────────────────────────────────────
exports.getStats = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const { role } = req.query; // "provider" ou "client"

  if (!role) {
    return next(new ApiError('Le paramètre "role" est requis (provider | client)', 400));
  }

  // ── PROVIDER ──────────────────────────────────────────────────────────────
  if (role === 'provider') {

    // Récupérer le provider_id depuis users.id
    const providerRes = await db.query(
      'SELECT id FROM providers WHERE user_id = $1', [userId]
    );
    if (providerRes.rows.length === 0) {
      return next(new ApiError('Provider profile not found', 404));
    }
    const providerId = providerRes.rows[0].id;

    // Total des gains sur les bookings complétés
    const earningsRes = await db.query(`
      SELECT COALESCE(SUM(b.amount), 0) AS total_earnings
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      WHERE s.provider_id = $1
        AND b.status = 'completed'
    `, [providerId]);

    // Nombre de jobs complétés
    const completedRes = await db.query(`
      SELECT COUNT(*) AS completed_jobs
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      WHERE s.provider_id = $1
        AND b.status = 'completed'
    `, [providerId]);

    // Bookings actifs (pending + confirmed + in-progress)
    const activeRes = await db.query(`
      SELECT COUNT(*) AS active_bookings
      FROM bookings b
      JOIN services s ON s.id = b.service_id
      WHERE s.provider_id = $1
        AND b.status IN ('pending', 'confirmed', 'in-progress')
    `, [providerId]);

    // Moyenne des avis + nombre total
    const ratingRes = await db.query(`
  SELECT
    COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0) AS avg_rating,
    COUNT(r.id) AS total_reviews,
    COUNT(*) FILTER (WHERE r.rating = 5) AS five_star,
    COUNT(*) FILTER (WHERE r.rating = 4) AS four_star,
    COUNT(*) FILTER (WHERE r.rating = 3) AS three_star,
    COUNT(*) FILTER (WHERE r.rating = 2) AS two_star,
    COUNT(*) FILTER (WHERE r.rating = 1) AS one_star
  FROM reviews r
  JOIN bookings b ON b.id = r.booking_id
  JOIN services s ON s.id = b.service_id
  WHERE s.provider_id = $1
`, [providerId]);

    return res.status(200).json({
      total_earnings: parseFloat(earningsRes.rows[0].total_earnings),
      completed_jobs: parseInt(completedRes.rows[0].completed_jobs),
      active_bookings: parseInt(activeRes.rows[0].active_bookings),
      avg_rating: ratingRes.rows[0].avg_rating ?? null,
      total_reviews: parseInt(ratingRes.rows[0].total_reviews),
    });
  }

  // ── CLIENT ────────────────────────────────────────────────────────────────
  if (role === 'client') {

    // Récupérer le client_id depuis users.id
    const clientRes = await db.query(
      'SELECT id FROM clients WHERE user_id = $1', [userId]
    );
    if (clientRes.rows.length === 0) {
      return next(new ApiError('Profil client introuvable', 404));
    }
    const clientId = clientRes.rows[0].id;

    // Total dépensé sur les bookings complétés
    const spentRes = await db.query(`
      SELECT COALESCE(SUM(amount), 0) AS total_spent
      FROM bookings
      WHERE client_id = $1
        AND status = 'completed'
    `, [clientId]);

    // Nombre de jobs complétés
    const completedRes = await db.query(`
      SELECT COUNT(*) AS completed_jobs
      FROM bookings
      WHERE client_id = $1
        AND status = 'completed'
    `, [clientId]);

    // Bookings actifs
    const activeRes = await db.query(`
      SELECT COUNT(*) AS active_bookings
      FROM bookings
      WHERE client_id = $1
        AND status IN ('pending', 'confirmed', 'in-progress')
    `, [clientId]);

    // Moyenne des notes données par ce client
    const ratingRes = await db.query(`
      SELECT ROUND(AVG(rating)::numeric, 1) AS avg_rating_given
      FROM reviews
      WHERE client_id = $1
    `, [clientId]);

    return res.status(200).json({
      total_spent: parseFloat(spentRes.rows[0].total_spent),
      completed_jobs: parseInt(completedRes.rows[0].completed_jobs),
      active_bookings: parseInt(activeRes.rows[0].active_bookings),
      avg_rating_given: ratingRes.rows[0].avg_rating_given ?? null,
    });
  }

  // Rôle inconnu
  return next(new ApiError('Rôle invalide. Utiliser "provider" ou "client"', 400));
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /dashboard/provider/:userId
//
// Endpoint complet pour le dashboard provider (stats + bookings récents).
// Conservé pour compatibilité avec l'ancien contrôleur.
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

  // Stats globales
  const statsRes = await db.query(`
    SELECT
      COUNT(b.id)                                                     AS total_bookings,
      COUNT(b.id) FILTER (WHERE b.status = 'pending')                AS pending_bookings,
      COUNT(b.id) FILTER (WHERE b.status = 'completed')              AS completed_jobs,
      COUNT(b.id) FILTER (WHERE b.status IN
        ('pending','confirmed','in-progress'))                        AS active_bookings,
      COALESCE(SUM(b.amount) FILTER (WHERE b.status = 'completed'),0) AS total_earnings,
      (SELECT COUNT(*) FROM services WHERE provider_id = $1)         AS total_services,
      (SELECT ROUND(AVG(rating)::numeric,1)
       FROM reviews WHERE provider_id = $1)                          AS avg_rating,
      (SELECT COUNT(*) FROM reviews WHERE provider_id = $1)          AS total_reviews
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    WHERE s.provider_id = $1
  `, [providerId]);
  res.status(200).json({
    status: 'success',
    data: {
      stats: statsRes.rows[0]
    },
  });
});

exports.getBookingRequests = catchAsync(async (req, res, next) => {
  const { userId } = req.params;

  const providerRes = await db.query(
    'SELECT id FROM providers WHERE user_id = $1',
    [userId]
  );

  if (providerRes.rows.length === 0) {
    return next(new ApiError('Provider non trouvé', 404));
  }

  const providerId = providerRes.rows[0].id;

  const bookingsRes = await db.query(`
    SELECT
      b.id,
      b.date,
      b.time,
      b.status,
      b.amount,
      b.details,
      s.title AS service_name,

      u.name AS client_name,
      u.profile_image AS client_image

    FROM bookings b
    JOIN services s ON b.service_id = s.id
    JOIN clients c ON b.client_id = c.id
    JOIN users u ON c.user_id = u.id

    WHERE s.provider_id = $1
      AND b.status = 'pending'

    ORDER BY b.date ASC, b.time ASC
  `, [providerId]);

  res.status(200).json({
    status: 'success',
    results: bookingsRes.rows.length,
    data: bookingsRes.rows,
  });
});

// Accepter la requête
exports.acceptBooking = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query(
            "UPDATE bookings SET status = 'confirmed' WHERE id = $1 RETURNING *",
            [id]
        );
        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Erreur lors de l'acceptation" });
    }
};

// Refuser la requête
exports.declineBooking = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query("DELETE FROM bookings WHERE id = $1", [id]);
        res.status(200).json({ message: "Réservation supprimée" });
    } catch (err) {
        res.status(500).json({ error: "Erreur lors du refus" });
    }
};
// ─────────────────────────────────────────────────────────────────────────────
// GET /dashboard/client/:userId
//
// Endpoint complet pour le dashboard client (stats + bookings en cours).
// Conservé pour compatibilité avec l'ancien contrôleur.
// ─────────────────────────────────────────────────────────────────────────────
exports.getClientDashboard = catchAsync(async (req, res, next) => {
  const { userId } = req.params;

  const clientRes = await db.query(
    'SELECT id FROM clients WHERE user_id = $1', [userId]
  );
  if (clientRes.rows.length === 0) {
    return next(new ApiError('Client non trouvé', 404));
  }
  const clientId = clientRes.rows[0].id;

  // Stats globales client
  const statsRes = await db.query(`
    SELECT
      COUNT(*)                                                          AS total_bookings,
      COUNT(*) FILTER (WHERE status = 'completed')                     AS completed_jobs,
      COUNT(*) FILTER (WHERE status IN
        ('pending','confirmed','in-progress'))                          AS active_bookings,
      COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0)     AS total_spent,
      (SELECT ROUND(AVG(rating)::numeric,1)
       FROM reviews WHERE client_id = $1)                              AS avg_rating_given
    FROM bookings
    WHERE client_id = $1
  `, [clientId]);

  // 5 prochains bookings avec infos provider
  const bookingsRes = await db.query(`
    SELECT
      b.*,
      s.name          AS service_name,
      u.name          AS provider_name,
      u.profile_image AS provider_image
    FROM bookings b
    JOIN services  s ON b.service_id  = s.id
    JOIN providers p ON s.provider_id = p.id
    JOIN users     u ON p.user_id     = u.id
    WHERE b.client_id = $1
    ORDER BY b.date ASC
    LIMIT 5
  `, [clientId]);

  res.status(200).json({
    status: 'success',
    data: {
      stats: statsRes.rows[0],
      bookings: bookingsRes.rows,
    },
  });
});