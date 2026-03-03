const pool = require("../../db");

// Get all services with provider name and governorate
const getAllServices = async () => {
  const query = `
  SELECT
    s.id AS service_id,
    s.title,
    s.description,
    s.category,
    u.full_name AS provider_name,
    p.city AS governorate
  FROM services s
  JOIN providers p ON s.provider_id = p.id
  JOIN users u ON p.user_id = u.id
  ORDER BY s.id;
  `;
  const result = await pool.query(query);
  return result.rows;
};

// Get a single service by id with provider name and governorate
const getServiceById = async (id) => {
  const query = `
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
    WHERE s.id = $1;
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

// Create a new service
const createService = async (provider_id, title, description, category) => {
  const query = `
    INSERT INTO services (provider_id, title, description, category)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  const result = await pool.query(query, [provider_id, title, description, category]);
  return result.rows[0];
};

// Update an existing service
const updateService = async (id, title, description, category) => {
  const query = `
    UPDATE services
    SET title = $1, description = $2, category = $3
    WHERE id = $4
    RETURNING *
  `;
  const result = await pool.query(query, [title, description, category, id]);
  return result.rows[0];
};

// Delete a service
const deleteService = async (id) => {
  await pool.query("DELETE FROM services WHERE id = $1", [id]);
};

module.exports = {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
};