const ChatModel = require("../models/chat");

const chatController = {
  async startConversation(req, res) {
    try {
      const { partnerId, userId } = req.body;
      if (!partnerId || !userId) {
        return res.status(400).json({ error: "partnerId and userId required" });
      }
      if (Number(partnerId) === Number(userId)) {
        return res.status(400).json({ error: "Cannot message yourself" });
      }

      const conversation = await ChatModel.findOrCreateConversation(
        Number(userId),
        Number(partnerId)
      );
      res.json(conversation);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to start conversation" });
    }
  },

  async getUserChats(req, res) {
    try {
      const userId = req.query.userId;
      if (!userId) {
        return res.status(400).json({ error: "userId required" });
      }

      const chats = await ChatModel.getConversations(Number(userId));
      console.log(`Backend: Found ${chats.length} chats for user ${userId}`);
      res.json(chats);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  },

  async getChatHistory(req, res) {
    try {
      const { conversationId } = req.params;
      const messages = await ChatModel.getMessages(conversationId);
      res.json(messages);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  },

  async sendMessage(req, res) {
    try {
      const { conversationId, content, userId } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ error: "Message content required" });
      }

      const message = await ChatModel.createMessage(
        conversationId,
        userId,
        content.trim()
      );

      res.json(message);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Message failed" });
    }
  },

  // ✅ NEW METHOD (FIXED)
  async respondToQuotation(req, res) {
    try {
      const { messageId,content } = req.body;
      console.log(`Backend: Responding to quotation with ID ${messageId} and content ${content}`);

      if (!messageId || !content) {
        return res.status(400).json({ error: "Missing data" });
      }

      const updatedMessage = await ChatModel.updateQuotationStatus(
        messageId,
        content
      );

      res.json(updatedMessage);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
};

module.exports = chatController;