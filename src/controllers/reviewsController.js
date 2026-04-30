const pool = require("../../db");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/apiError");

exports.getProviderReviews = catchAsync(async (req, res) => {
    const { userId } = req.params;

    const query = `
    SELECT 
      r.id,
      r.rating,
      r.comment,
      r.created_at,
      u_client.name AS client_name,
      u_client.profile_image AS client_image,
      COALESCE(s.title, t.title) AS service_name
    FROM reviews r
    JOIN clients c      ON c.id = r.client_id  
    JOIN users u_client ON u_client.id = c.user_id     
    JOIN bookings b    ON b.id = r.booking_id
    LEFT JOIN services s ON s.id = b.service_id
    LEFT JOIN tasks t    ON t.id = b.task_id
    JOIN providers p    ON (p.id = s.provider_id OR p.id = b.provider_id)
    WHERE p.user_id = $1
    ORDER BY r.created_at DESC;
  `;

    const { rows } = await pool.query(query, [userId]);

    return res.status(200).json({
        success: true,
        results: rows.length,
        data: rows
    });
});

exports.getRatingSummary = catchAsync(async (req, res) => {
    const userId = req.params.userId;

    const query = `
  SELECT 
    COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0) AS avg_rating,
    COUNT(r.id)::int AS total,
    COUNT(r.id) FILTER (WHERE r.rating = 5)::int AS five,
    COUNT(r.id) FILTER (WHERE r.rating = 4)::int AS four,
    COUNT(r.id) FILTER (WHERE r.rating = 3)::int AS three,
    COUNT(r.id) FILTER (WHERE r.rating = 2)::int AS two,
    COUNT(r.id) FILTER (WHERE r.rating = 1)::int AS one
  FROM reviews r
  JOIN bookings b ON b.id = r.booking_id
  LEFT JOIN services s ON s.id = b.service_id
  JOIN providers p ON (p.id = s.provider_id OR p.id = b.provider_id)
  WHERE p.user_id = $1
`;

    const { rows } = await pool.query(query, [userId]);
    console.log("🚀 ~ rows:", rows)

    return res.status(200).json({
        success: true,
        data: rows[0],
    });
});
exports.createReview = catchAsync(async (req, res, next) => {
    const { booking_id, rating, comment } = req.body;
    const userId = req.user.id;
    const clientRes = await pool.query(
        'SELECT id FROM clients WHERE user_id = $1',
        [userId]
    );

    if (clientRes.rows.length === 0) {
        return next(new ApiError("Seuls les clients peuvent laisser un avis.", 403));
    }
    const clientId = clientRes.rows[0].id;
    try {
        const newReview = await pool.query(
            `INSERT INTO reviews (booking_id, client_id, rating, comment) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
            [booking_id, clientId, rating, comment]
        );

        res.status(201).json({
            status: 'success',
            data: newReview.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') {
            return next(new ApiError("You have already left a review for this provider", 400));
        }
        throw error;
    }
});