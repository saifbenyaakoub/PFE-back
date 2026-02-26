const pool = require("../config/db");

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

module.exports = {
  getAllServices,
  getServiceById,
};
