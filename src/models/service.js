const pool = require("../config/db");

// Get all services
const getAllServices = async () => {
  const result = await pool.query(`
    SELECT 
      s.id,
      s.title,
      s.description,
      s.category,
      u.name AS provider_name,
      p.city AS city
    FROM services s
    JOIN providers p ON s.provider_id = p.id
    JOIN users u ON p.user_id = u.id
    ORDER BY s.id;
  `);
  return result.rows;
};

// Get service by ID
const getServiceById = async (id) => {
  const result = await pool.query(`
    SELECT 
      s.id,
      s.title,
      s.description,
      s.category,
      u.name AS provider_name,
      p.city AS city
    FROM services s
    JOIN providers p ON s.provider_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE s.id = $1;
  `, [id]);
  return result.rows[0];
};

module.exports = { getAllServices, getServiceById };