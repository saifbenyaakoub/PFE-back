const pool = require('../../db'); // Your DB connection file

const ChatModel = {
  // Get all conversations for a specific user
 async getConversations(userId) {
  const query = `
    SELECT 
      c.id,
      c.created_at,
      -- Get the 'Other' user's details
      CASE 
        WHEN c.user1_id = $1 THEN u2.name 
        ELSE u1.name 
      END AS other_user_name,
      CASE 
        WHEN c.user1_id = $1 THEN u2.id 
        ELSE u1.id 
      END AS other_user_id,
      CASE 
        WHEN c.user1_id = $1 THEN u2.profile_image 
        ELSE u1.profile_image 
      END AS other_user_image,
      -- Subquery for the latest message preview
      (SELECT text FROM messages 
       WHERE conversation_id = c.id 
       ORDER BY created_at DESC LIMIT 1) AS last_message,
      (SELECT created_at FROM messages 
       WHERE conversation_id = c.id 
       ORDER BY created_at DESC LIMIT 1) AS last_message_time
    FROM conversations c
    JOIN users u1 ON c.user1_id = u1.id
    JOIN users u2 ON c.user2_id = u2.id
    WHERE c.user1_id = $1 OR c.user2_id = $1
    ORDER BY last_message_time DESC NULLS LAST;
  `;
  
  const { rows } = await pool.query(query, [userId]);
  return rows;
},

  // Save a new message
  async createMessage(conversationId, senderId, text) {
    const query = `
      INSERT INTO messages (conversation_id, sender_id, text)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [conversationId, senderId, text]);
    return rows[0];
  },

  // Get message history for a conversation
  async getMessages(conversationId) {
    const query = `
      SELECT m.*, u.name as sender_name 
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE conversation_id = $1
      ORDER BY created_at ASC;
    `;
    const { rows } = await pool.query(query, [conversationId]);
    return rows;
  }
};

module.exports = ChatModel;