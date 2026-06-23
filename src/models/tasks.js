const pool = require("../../db");

// Get all services
const getAllTasks = async () => {
  const result = await pool.query(`
  SELECT 
    t.id,
    t.title,
    t.description,
    t.category,
    t.status,
    t.image_url,
    u.name             AS client_name,
    u.id               AS client_id,
    u.profile_image    AS client_image,
    u.latitude::float8  AS latitude,
    u.longitude::float8 AS longitude,
    c.city AS city
  FROM tasks t
  JOIN clients c ON t.client_id = c.id
  JOIN users   u ON c.user_id   = u.id
  ORDER BY t.id
`);
  return result.rows;
};

// Get service by id
const getTaskById = async (id) => {
  const result = await pool.query(`
  SELECT 
    t.id,
    t.title,
    t.description,
    t.category,
    t.status,
    t.image_url,
    u.name             AS client_name,
    u.id               AS client_id,
    u.profile_image    AS client_image,
    u.latitude::float8  AS latitude,
    u.longitude::float8 AS longitude,
    c.city AS city
  FROM tasks t
  JOIN clients c ON t.client_id = c.id
  JOIN users   u ON c.user_id   = u.id
  WHERE t.id = $1
`, [id]);

  return result.rows[0];
};

module.exports = {
  getAllTasks,
  getTaskById,
};