const pool = require("../../db");

// Create booking
const createBooking = async (service_id, client_id, date, time, details) => {
  const result = await pool.query(
    `
    INSERT INTO bookings (service_id, client_id, date, time, details)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [service_id, client_id, date, time, details]
  );

  return result.rows[0];
};

// Get all bookings
const getAllBookings = async () => {
  const result = await pool.query(`
    SELECT 
      b.id,
      b.date,
      b.time,
      b.details,
      s.title AS service_title,
      s.category,
      u.name AS provider_name,
      p.city AS city
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    JOIN providers p ON s.provider_id = p.id
    JOIN users u ON p.user_id = u.id
    ORDER BY b.id;
  `);

  return result.rows;
};

// Get booking by id
const getBookingById = async (id) => {
  const result = await pool.query(
    `
    SELECT 
      b.id,
      b.date,
      b.time,
      b.details,
      s.title AS service_title,
      s.category,
      u.name AS provider_name,
      p.city AS city
    FROM bookings b
    JOIN services s ON b.service_id = s.id
    JOIN providers p ON s.provider_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE b.id = $1
    `,
    [id]
  );

  return result.rows[0];
};

module.exports = {
  createBooking,
  getAllBookings,
  getBookingById,
};