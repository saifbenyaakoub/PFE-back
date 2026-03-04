const pool = require("../config/db");

// Get all services
const getAllServices = async () => {
  const result = await pool.query(`
      SELECT 
        s.id,
        s.title,
        s.description,
        s.category,
        u.full_name AS provider_name,
        p.city AS governorate
      FROM services s
      JOIN providers p ON s.provider_id = p.id
      JOIN users u ON p.user_id = u.id
      ORDER BY s.id;
    `);
  return result.rows;
};

// Get service by id
const getServiceById = async (id) => {
  const result = await pool.query(
    "SELECT * FROM services WHERE id = $1",
    [id]
  );
  return result.rows[0];
};

module.exports = {
  getAllServices,
  getServiceById,
};
