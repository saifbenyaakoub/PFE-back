const pool = require("../config/db");

// Get all services
const getAllTasks = async () => {
  const result = await pool.query("SELECT * FROM tasks");
  return result.rows;
};

// Get service by id
const getTaskById = async (id) => {
  const result = await pool.query(
    "SELECT * FROM tasks WHERE id = $1",
    [id]
  );
  return result.rows[0];
};

module.exports = {
  getAllTasks,
  getTaskById,
};
