const pool = require("../config/db");

exports.createClient = async (userId, city) => {
  await pool.query(
    `INSERT INTO clients (user_id, city)
     VALUES ($1, $2)`,
    [userId, city]
  );
};