const pool = require("../../db");

// Get all services
const getAllServices = async () => {
  const result = await pool.query("SELECT * FROM services");
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

// Create a new service
const createService = async (name, description) => {
  const result = await pool.query(
    "INSERT INTO services (name, description) VALUES ($1, $2) RETURNING *",
    [name, description]
  );
  return result.rows[0];
};

// Update a service
const updateService = async (id, name, description) => {
  const result = await pool.query(
    "UPDATE services SET name = $1, description = $2 WHERE id = $3 RETURNING *",
    [name, description, id]
  );
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
