const pool = require("../../db.js");

const Booking = {
  create: async ({ service_id, client_id, date, time, details, total_price }) => {
    const query = `
      INSERT INTO bookings (service_id, client_id, date, time, details, total_price)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [
      service_id,
      client_id,
      date,
      time,
      details,
      total_price,
    ]);
    return rows[0];
  },
};

module.exports = Booking;