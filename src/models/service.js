const pool = require("../../db");

// Get all services with rating and hire counts
const getAllServices = async () => {
  const result = await pool.query(`
    SELECT 
      s.id,
      s.title,
      s.description,
      s.category,
      u.name AS provider_name,
      u.id AS provider_id,
      u.profile_image AS "profileImage",
      p.city AS city,
      COALESCE(ROUND(AVG(r.rating), 1), 0) AS rate,
      COUNT(DISTINCT r.id) AS review_count,
      COUNT(DISTINCT b.id) AS hire_count
    FROM services s
    JOIN providers p ON s.provider_id = p.id
    JOIN users u ON p.user_id = u.id
    LEFT JOIN bookings b ON b.provider_id = u.id -- Updated to match your fk_provider constraint
    LEFT JOIN reviews r ON r.booking_id = b.id
    GROUP BY s.id, u.name, u.id, u.profile_image, p.city
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
      u.id AS provider_id,
      u.profile_image AS "profileImage",
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