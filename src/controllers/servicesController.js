const db         = require('../../db');
const catchAsync = require('../utils/catchAsync');
const ApiError   = require('../utils/apiError');

// HELPER — résoudre provider_id depuis user_id
const getProviderId = async (userId) => {
  console.log("Recherche du provider pour l'USER_ID :", userId);
  const res = await db.query('SELECT id FROM providers WHERE user_id = $1', [userId]);
  
  if (res.rows.length === 0) {
    console.error("AUCUN provider trouvé en base pour cet ID.");
  } else {
    console.log("Provider trouvé ID :", res.rows[0].id);
  }
  
  return res.rows[0]?.id ?? null;
};

// GET /services
exports.getAllServices = catchAsync(async (req, res) => {
  const { rows } = await db.query(`
    SELECT s.*, u.name AS provider_name, p.city,
    ROUND(AVG(r.rating)::numeric, 1) AS avg_rating
    FROM services s
    JOIN providers p ON p.id = s.provider_id
    JOIN users u ON u.id = p.user_id
    LEFT JOIN bookings b ON b.service_id = s.id
    LEFT JOIN reviews r ON r.booking_id = b.id
    WHERE s.is_active = true
    GROUP BY s.id, u.name, p.city
    ORDER BY s.created_at DESC
  `);
  res.status(200).json({ status: 'success', results: rows.length, data: rows });
});

// GET /services/category/:category
exports.getByCategory = catchAsync(async (req, res) => {
  const { category } = req.params;
  const { rows } = await db.query(`
    SELECT s.*, u.name AS provider_name, p.city
    FROM services s
    JOIN providers p ON p.id = s.provider_id
    JOIN users u ON u.id = p.user_id
    WHERE s.category = $1 AND s.is_active = true
    GROUP BY s.id, u.name, p.city
  `, [category]);
  res.status(200).json({ status: 'success', data: rows });
});

// GET /services/provider/:userId (Profil public du prestataire)
exports.getProviderServices = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  const providerId = await getProviderId(userId);
  if (!providerId) return next(new ApiError('Prestataire non trouvé', 404));

  const { rows } = await db.query(`
    SELECT s.*, COUNT(b.id) AS total_bookings
    FROM services s
    LEFT JOIN bookings b ON b.service_id = s.id
    WHERE s.provider_id = $1
    GROUP BY s.id
  `, [providerId]);
  res.status(200).json({ status: 'success', data: rows });
});

// GET /services/:id
exports.getServiceById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { rows } = await db.query(`SELECT * FROM services WHERE id = $1`, [id]);
  if (rows.length === 0) return next(new ApiError('Service introuvable', 404));
  res.status(200).json({ status: 'success', data: rows[0] });
});

// POST /services
exports.createService = catchAsync(async (req, res, next) => {
  console.log("req.user:", req.user);
  const { title, category, description } = req.body;
  const userId = req.user.id || req.user.userId;
  const providerId = await getProviderId(userId);
  console.log("providerid = ",providerId);
  if (!providerId) return next(new ApiError('Profil prestataire requis', 403));

  const { rows } = await db.query(
    `INSERT INTO services (provider_id, title, category, description, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [providerId, title, category, description || null, true]
  );
  res.status(201).json({ status: 'success', data: rows[0] });
});

// PUT /services/:id
exports.updateService = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { title, category, description } = req.body;
  const userId = req.user.id || req.user.userId;
  const providerId = await getProviderId(userId);

  const { rows } = await db.query(
    `UPDATE services SET title = $1, category = $2, description = $3 
     WHERE id = $4 AND provider_id = $5 RETURNING *`,
    [title, category, description, id, providerId]
  );

  if (rows.length === 0) return next(new ApiError('Non autorisé ou inexistant', 404));
  res.status(200).json({ status: 'success', data: rows[0] });
});

// PATCH /services/:id/toggle
exports.toggleService = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.id || req.user.userId;
  const providerId = await getProviderId(userId);
  const { rows } = await db.query(
    `UPDATE services SET is_active = NOT is_active 
     WHERE id = $1 AND provider_id = $2 RETURNING id, is_active`,
    [id, providerId]
  );

  if (rows.length === 0) return next(new ApiError('Action impossible', 404));
  res.status(200).json({ status: 'success', data: rows[0] });
});

// DELETE /services/:id
exports.deleteService = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userId = req.user.id || req.user.userId;
  const providerId = await getProviderId(userId);
  const check = await db.query(
    `SELECT COUNT(*) FROM bookings WHERE service_id = $1 AND status IN ('pending', 'confirmed')`,
    [id]
  );
  if (parseInt(check.rows[0].count) > 0) return next(new ApiError('Réservations en cours', 400));

  const result = await db.query(`DELETE FROM services WHERE id = $1 AND provider_id = $2`, [id, providerId]);
  if (result.rowCount === 0) return next(new ApiError('Service non trouvé', 404));

  res.status(200).json({ status: 'success', message: 'Service supprimé avec succès' });
});