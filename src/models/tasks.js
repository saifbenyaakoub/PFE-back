const pool = require("../../db");

// Get all services
const getAllTasks = async () => {
  const result = await pool.query(`SELECT 
  t.id,
  t.title,
  t.description,
  t.category,
  t.status,
  u.name AS client_name,
  c.city AS city
FROM tasks t
JOIN clients c ON t.client_id = c.id
JOIN users u ON c.user_id = u.id
ORDER BY t.id;`);
  return result.rows;
};

// Get service by id
const getTaskById = async (id) => {
  const result = await pool.query(
    `SELECT 
      t.id,
      t.title,
      t.description,
      t.category,
      t.status,
      u.name AS client_name,
      c.city AS city
    FROM tasks t
    JOIN clients c ON t.client_id = c.id
    JOIN users u ON c.user_id = u.id
    WHERE t.id = $1`,
    [id]
  );

  return result.rows[0];
};

module.exports = {
  getAllTasks,
  getTaskById,
};
