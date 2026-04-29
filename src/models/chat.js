const pool = require("../../db");

const ChatModel = {
  async findOrCreateConversation(userId1, userId2, serviceId = null) {
    const [u1, u2] = userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];

    const existing = await pool.query(
      `SELECT * FROM conversations WHERE user1_id = $1 AND user2_id = $2`,
      [u1, u2]
    );
    if (existing.rows[0]) return existing.rows[0];

    const result = await pool.query(
      `INSERT INTO conversations (user1_id, user2_id, service_id) VALUES ($1, $2, $3) RETURNING *`,
      [u1, u2, serviceId]
    );
    return result.rows[0];
  },

  async getConversations(userId) {
    const query = `
      SELECT
        c.id,
        c.service_id,
        c.created_at,
        CASE WHEN c.user1_id = $1 THEN u2.name  ELSE u1.name  END AS other_user_name,
        CASE WHEN c.user1_id = $1 THEN u2.id    ELSE u1.id    END AS other_user_id,
        CASE WHEN c.user1_id = $1 THEN u2.profile_image ELSE u1.profile_image END AS other_user_image,
        CASE WHEN c.user1_id = $1 THEN u2.role  ELSE u1.role  END AS other_user_role,
        m.content    AS last_message,
        m.created_at AS last_message_time,
        m.sender_id  AS last_message_sender_id
      FROM conversations c
      JOIN users u1 ON c.user1_id = u1.id
      JOIN users u2 ON c.user2_id = u2.id
      LEFT JOIN LATERAL (
        SELECT content, created_at, sender_id FROM messages
        WHERE conversation_id = c.id
        ORDER BY created_at DESC LIMIT 1
      ) m ON true
      WHERE c.user1_id = $1 OR c.user2_id = $1
      ORDER BY COALESCE(m.created_at, c.created_at) DESC;
    `;
    const { rows } = await pool.query(query, [userId]);
    return rows;
  },

  async createMessage(conversationId, senderId, content) {
    const result = await pool.query(
      `WITH inserted AS (
         INSERT INTO messages (conversation_id, sender_id, content)
         VALUES ($1, $2, $3) RETURNING *
       )
       SELECT i.*, u.name AS sender_name, u.profile_image AS sender_image
       FROM inserted i
       JOIN users u ON i.sender_id = u.id`,
      [conversationId, senderId, content]
    );
    return result.rows[0];
  },

  async getMessages(conversationId) {
    const query = `
      SELECT m.*, u.name AS sender_name, u.profile_image AS sender_image
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC;
    `;
    const { rows } = await pool.query(query, [conversationId]);
    return rows;
  },

  // Fixed: use parameterized query instead of string interpolation
  async updateQuotationStatus(messageId, content) {
    const result = await pool.query(
      `UPDATE messages SET content = $1 WHERE id = $2 RETURNING *`,
      [content, messageId]
    );
    return result.rows[0];
  },

  async createNotification(userId, type, actorId, content) {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, actor_id, content)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [userId, type, actorId, content]
    );
    return result.rows[0];
  },

  async getNotifications(userId) {
    const query = `
      SELECT
        n.id,
        n.type,
        n.content,
        n.is_read,
        n.created_at,
        u.name          AS actor_name,
        u.profile_image AS actor_image
      FROM notifications n
      LEFT JOIN users u ON n.actor_id = u.id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC;
    `;
    const { rows } = await pool.query(query, [userId]);
    return rows;
  },

  async markAllAsRead(userId) {
    await pool.query(`UPDATE notifications SET is_read = true WHERE user_id = $1`, [userId]);
  },

  async createBookingFromQuotation(clientUserId, providerUserId, startDate, amount, serviceId) {
    const clientRes   = await pool.query('SELECT id FROM clients   WHERE user_id = $1', [clientUserId]);
    const providerRes = await pool.query('SELECT id FROM providers WHERE user_id = $1', [providerUserId]);

    const clientId   = clientRes.rows[0]?.id;
    const providerId = providerRes.rows[0]?.id;

    if (!clientId)   throw new Error('Client profile not found');
    if (!providerId) throw new Error('Provider profile not found');
    if (!serviceId)  throw new Error('No service linked to this conversation');

    const { rows } = await pool.query(`
      INSERT INTO bookings (service_id, client_id, provider_id, date, amount, status, created_at)
      VALUES ($1, $2, $3, $4, $5, 'confirmed', NOW())
      RETURNING *
    `, [serviceId, clientId, providerId, startDate, amount]);

    return rows[0];
  },
};

module.exports = ChatModel;