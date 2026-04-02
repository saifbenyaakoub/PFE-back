const pool = require("../../db");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/apiError");

exports.getProviderReviews = catchAsync(async (req, res) => {
    const userId = req.params.userId
    console.log("🚀 ~ userId:", req.params)

    const query = `
    SELECT 
     r.id,
     r.rating,
     r.comment,
     r.created_at,
     u.name AS client_name,
     u.profile_image AS client_image,
     s.title AS service_name
    FROM reviews r
    JOIN users u      ON u.id = r.client_id
    JOIN bookings b   ON b.id = r.booking_id
    JOIN services s   ON s.id = b.service_id
    JOIN providers p  ON p.id = s.provider_id
    WHERE p.user_id = $1
    ORDER BY r.created_at DESC
  `;
    console.log("userid : ",userId);
    const { rows } = await pool.query(query, [userId]);

    return res.status(200).json({
        success: true,
        data: rows,
    });
});

exports.getRatingSummary = catchAsync(async (req, res) => {
       const userId = req.params.userId;
       console.log("🚀 ~ userId:", userId)

    const query = `
    SELECT 
     COALESCE(ROUND(AVG(r.rating)::numeric, 1), 0) AS avg_rating,
     COUNT(*)::int AS total,
     COUNT(*) FILTER (WHERE rating = 5) AS five,
     COUNT(*) FILTER (WHERE rating = 4) AS four,
     COUNT(*) FILTER (WHERE rating = 3) AS three,
     COUNT(*) FILTER (WHERE rating = 2) AS two,
     COUNT(*) FILTER (WHERE rating = 1) AS one
    FROM reviews r
    JOIN bookings b  ON b.id = r.booking_id
    JOIN services s  ON s.id = b.service_id
    JOIN providers p ON p.id = s.provider_id
    WHERE p.user_id = $1
  `;

    const { rows } = await pool.query(query, [userId]);
    console.log("🚀 ~ rows:", rows)

    return res.status(200).json({
        success: true,
        data: rows[0],
    });
});

exports.submitReview = catchAsync(async (req, res, next) => {
    const clientId = req.user.id;
    const { bookingId, rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
        return next(new ApiError(400, "Rating must be between 1 and 5"));
    }

    if (!bookingId) {
        return next(new ApiError(400, "Booking ID is required"));
    }

    const bookingCheck = await pool.query(
        `SELECT provider_id 
     FROM bookings 
     WHERE id = $1 
     AND client_id = $2 
     AND status = 'completed'`,
        [bookingId, clientId]
    );

    if (bookingCheck.rows.length === 0) {
        return next(new ApiError(403, "You cannot review this booking"));
    }

    const providerId = bookingCheck.rows[0].provider_id;

    const result = await pool.query(
        `
    INSERT INTO reviews (booking_id, client_id, provider_id, rating, comment)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (booking_id)
    DO UPDATE SET
      rating = EXCLUDED.rating,
      comment = EXCLUDED.comment,
      created_at = NOW()
    RETURNING *;
    `,
        [bookingId, clientId, providerId, rating, comment]
    );

    return res.status(200).json({
        success: true,
        data: result.rows[0],
    });
});