const pool = require("../config/db");

exports.createProvider = async (userId, serviceCategory, city) => {
  await pool.query(
    `INSERT INTO providers (user_id, service_category, city)
     VALUES ($1, $2, $3)`,
    [userId, serviceCategory, city]
  );
};