const pool = require("../../db");

const AdminModel = {
  // Fetch all tasks with client information
  async getAllUsers() {
    const query = `
      SELECT 
        u.id, u.name, u.email, u.role, u.created_at
      FROM users u
      ORDER BY u.created_at DESC;
    `;
    const { rows } = await pool.query(query);
    return rows;
  },
  async deleteUser(id) {
    await pool.query("DELETE FROM users WHERE id = $1", [id]);
  },

  // Fetch all tasks with client information

  async getAllTasks() {
    const query = `
      SELECT 
        t.*, 
        u.name AS client_name, 
        u.email AS client_email
      FROM tasks t
      JOIN clients c ON t.client_id = c.id
      JOIN users u ON c.user_id = u.id
      ORDER BY t.created_at DESC;
    `;
    const { rows } = await pool.query(query);
    return rows;
  },

  // Delete a task (cascades to proposals based on schema)
  async deleteTask(id) {
    await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
  },

  // Fetch all services with provider information
  async getAllServices() {
    const query = `
      SELECT 
        s.*, 
        u.name AS provider_name, 
        u.email AS provider_email
      FROM services s
      JOIN providers p ON s.provider_id = p.id
      JOIN users u ON p.user_id = u.id
      ORDER BY s.created_at DESC;
    `;
    const { rows } = await pool.query(query);
    return rows;
  },

  // Delete a service (cascades to bookings based on schema)
  async deleteService(id) {
    await pool.query("DELETE FROM services WHERE id = $1", [id]);
  }
};

module.exports = AdminModel;