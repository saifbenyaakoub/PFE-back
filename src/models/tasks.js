const pool = require("../../db");

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

// Create a new task
const createTask = async (title, description) => {
  const result = await pool.query(
    "INSERT INTO tasks (title, description) VALUES ($1, $2) RETURNING *",
    [title, description]
  );
  return result.rows[0];
};

// Update a task
const updateTask = async (id, title, description) => {
  const result = await pool.query(
    "UPDATE tasks SET title = $1, description = $2 WHERE id = $3 RETURNING *",
    [title, description, id]
  );
  return result.rows[0];
};

// Delete a task
const deleteTask = async (id) => {
  await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
};

module.exports = {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
};
