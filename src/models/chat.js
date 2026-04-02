const pool = require("../../db");

const ChatModel = {
  // Find or create a conversation between two users
  async findOrCreateConversation(userId1, userId2) {
    const [u1, u2] = userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];

    const existing = await pool.query(
      `SELECT * FROM conversations WHERE user1_id = $1 AND user2_id = $2`,
      [u1, u2]
    );
    if (existing.rows[0]) return existing.rows[0];

    const result = await pool.query(
      `INSERT INTO conversations (user1_id, user2_id) VALUES ($1, $2) RETURNING *`,
      [u1, u2]
    );
    return result.rows[0];
  },

  // Get all conversations for a user with last message + partner info
  async getConversations(userId) {
    const query = `
      SELECT 
        c.id, 
        c.created_at,
        CASE WHEN c.user1_id = $1 THEN u2.name ELSE u1.name END AS other_user_name,
        CASE WHEN c.user1_id = $1 THEN u2.id   ELSE u1.id   END AS other_user_id,
        CASE WHEN c.user1_id = $1 THEN u2.profile_image ELSE u1.profile_image END AS other_user_image,
        CASE WHEN c.user1_id = $1 THEN u2.role ELSE u1.role END AS other_user_role,
        m.content AS last_message,
        m.created_at AS last_message_time,
        m.sender_id AS last_message_sender_id
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

  // Save a new message
  async createMessage(conversationId, senderId, content) {
    const msg = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, content) 
       VALUES ($1, $2, $3) RETURNING *`,
      [conversationId, senderId, content]
    );

    return msg.rows[0];
  },

  // Get message history for a conversation
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
  }
};

module.exports = ChatModel;