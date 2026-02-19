const pool = require("../config/db");

exports.findByEmail = async (email) => {
  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );
  return result.rows[0];
};

exports.createUser = async (fullName, email, password, role) => {
  const result = await pool.query(
    `INSERT INTO users (full_name, email, password, role)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [fullName, email, password, role]
  );
  return result.rows[0];
};