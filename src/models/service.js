const pool = require("../../db");

// Get all services
const getAllServices = async () => {
  const result = await pool.query(`
    SELECT 
      s.id,
      s.title,
      s.description,
      s.category,
      u.name AS provider_name,
      u.id AS provider_id, -- Required for chat and bookings
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
      u.id AS provider_id, -- Required for chat and bookings
      p.city AS city
    FROM services s
    JOIN providers p ON s.provider_id = p.id
    JOIN users u ON p.user_id = u.id
    WHERE s.id = $1;
  `, [id]);
  return result.rows[0];
};

// Create a new service
const createService = async (serviceData) => {
  const { title, description, category, provider_id } = serviceData;
  const result = await pool.query(
    `INSERT INTO services (title, description, category, provider_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [title, description, category, provider_id]
  );
  return result.rows[0];
};

module.exports = { getAllServices, getServiceById, createService };