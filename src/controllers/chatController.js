const ChatModel = require('../models/chat');

const chatController = {
  // GET /api/chat/conversations
  async getUserChats(req, res) {
    try {
      const userId = req.user.id; // Assuming you have auth middleware
      const chats = await ChatModel.getConversations(userId);
      res.json(chats);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  },

  // GET /api/chat/:conversationId
  async getChatHistory(req, res) {
    try {
      const { conversationId } = req.params;
      const messages = await ChatModel.getMessages(conversationId);
      res.json(messages);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  },

  // POST /api/chat/message
  async sendMessage(req, res) {
    try {
      const { conversationId, text } = req.body;
      const senderId = req.user.id;
      const message = await ChatModel.createMessage(conversationId, senderId, text);
      
      // Note: In a real app, you'd trigger your Socket.io emit here or in the server file
      res.status(201).json(message);
    } catch (err) {
      res.status(500).json({ error: 'Message could not be sent' });
    }
  }
};

module.exports = chatController;