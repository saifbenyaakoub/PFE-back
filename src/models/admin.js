const pool = require("../../db");

const AdminModel = {

  // ─── Users ────────────────────────────────────────────────────────────────

  async getAllUsers() {
    const query = `
      SELECT id, name, email, role, created_at
      FROM users
      ORDER BY created_at DESC;
    `;
    const { rows } = await pool.query(query);
    return rows;
  },

  async deleteUser(id) {
    await pool.query("DELETE FROM users WHERE id = $1", [id]);
  },

  // ─── Tasks ────────────────────────────────────────────────────────────────

  async getAllTasks() {
    const query = `
      SELECT 
        t.*, 
        u.name  AS client_name, 
        u.email AS client_email
      FROM tasks t
      JOIN clients c ON t.client_id = c.id
      JOIN users  u ON c.user_id   = u.id
      ORDER BY t.created_at DESC;
    `;
    const { rows } = await pool.query(query);
    return rows;
  },

  async deleteTask(id) {
    await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
  },

  // ─── Services ─────────────────────────────────────────────────────────────

  async getAllServices() {
    const query = `
      SELECT 
        s.*, 
        u.name  AS provider_name, 
        u.email AS provider_email
      FROM services s
      JOIN providers p ON s.provider_id = p.id
      JOIN users     u ON p.user_id     = u.id
      ORDER BY s.created_at DESC;
    `;
    const { rows } = await pool.query(query);
    return rows;
  },

  async deleteService(id) {
    await pool.query("DELETE FROM services WHERE id = $1", [id]);
  },

  // ─── Reports (désactivé temporairement — table non encore créée) ────────────

  async getAllReports() {
    return [];
  },

  async deleteReport(id) {
    return;
  },
};

module.exports = AdminModel;