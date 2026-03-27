const ChatModel = require("../models/chat");

const chatController = {
  // POST /chat/conversations — start or get a conversation
  async startConversation(req, res) {
    try {
      const { partnerId } = req.body;
      if (!partnerId) return res.status(400).json({ error: "partnerId is required" });
      if (Number(partnerId) === req.user.id) {
        return res.status(400).json({ error: "Cannot message yourself" });
      }
      const conversation = await ChatModel.findOrCreateConversation(req.user.id, Number(partnerId));
      res.json(conversation);
    } catch (err) {
      console.error("Error starting conversation:", err);
      res.status(500).json({ error: "Failed to start conversation" });
    }
  },

  // GET /chat/conversations — list all user conversations
  async getUserChats(req, res) {
    try {
      const userId = req.user.id;
      const chats = await ChatModel.getConversations(userId);
      res.json(chats);
    } catch (err) {
      console.error("Error fetching conversations:", err);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  },

  // GET /chat/messages/:conversationId — get message history
  async getChatHistory(req, res) {
    try {
      const { conversationId } = req.params;
      const messages = await ChatModel.getMessages(conversationId);
      // Mark as read
      await ChatModel.markAsRead(conversationId, req.user.id);
      res.json(messages);
    } catch (err) {
      console.error("Error fetching messages:", err);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  },

  // POST /chat/message — send a message via REST
  async sendMessage(req, res) {
    try {
      const { conversationId, text } = req.body;
      if (!text || !text.trim()) return res.status(400).json({ error: "Message text is required" });
      const senderId = req.user.id;
      const message = await ChatModel.createMessage(conversationId, senderId, text.trim());
      res.status(201).json(message);
    } catch (err) {
      console.error("Error sending message:", err);
      res.status(500).json({ error: "Message could not be sent" });
    }
  },
};

module.exports = chatController;
