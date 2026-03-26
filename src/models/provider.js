const pool = require("../../db");

exports.createProvider = async (userId, serviceCategory, city) => {
  const result = await pool.query(
    `INSERT INTO providers (user_id, service_category, city)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, serviceCategory, city]
  );
  return result.rows[0];
};