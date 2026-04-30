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


  const statsRes = await db.query(`
    SELECT 
      (SELECT COALESCE(SUM(amount), 0) FROM bookings WHERE client_id = $1 AND status = 'completed') AS total_spent,
      (SELECT COUNT(*) FROM tasks WHERE client_id = $1 AND status = 'completed') AS completed_jobs,
      (SELECT COUNT(*) FROM bookings WHERE client_id = $1 AND status IN ('pending', 'confirmed')) AS active_bookings,
      (SELECT COUNT(*) FROM tasks WHERE client_id = $1) AS total_posted_tasks
    FROM clients WHERE id = $1
  `, [clientId]);

  const tasksRes = await db.query(`
  SELECT 
    t.id, 
    t.title, 
    t.category, 
    t.created_at AS date, 
    t.status, 
    t.image_url AS image,
    COUNT(p.id)::int AS applicants,
    b.id AS booking_id,
    u.name AS provider_name,
    (SELECT COUNT(*) FROM reviews WHERE booking_id = b.id)::int > 0 AS has_reviewed

  FROM tasks t
  LEFT JOIN proposals p ON t.id = p.task_id
  LEFT JOIN bookings b ON t.id = b.task_id AND b.client_id = t.client_id
  LEFT JOIN providers prov ON b.provider_id = prov.id
  LEFT JOIN users u ON prov.user_id = u.id
  WHERE t.client_id = $1
  GROUP BY t.id, b.id, u.name
  ORDER BY t.created_at DESC
`, [clientId]);

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const tasks = tasksRes.rows.map(task => ({
    ...task,
    date: formatDate(task.date),
    image: task.image || null
  }));

  res.status(200).json({
    status: 'success',
    data: {
      stats: {
        totalSpent: parseFloat(statsRes.rows[0]?.total_spent || 0),
        completedJobs: parseInt(statsRes.rows[0]?.completed_jobs || 0),
        activeBookings: parseInt(statsRes.rows[0]?.active_bookings || 0),
        postedTasks: parseInt(statsRes.rows[0]?.total_posted_tasks || 0)
      },
      appliedTasks: tasks
    }
  });
});