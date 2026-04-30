const ChatModel = require("../models/chat");
const pool      = require("../../db");

const chatController = {
  async startConversation(req, res) {
    try {
      const { partnerId, userId, serviceId } = req.body;
      if (!partnerId || !userId)
        return res.status(400).json({ error: "partnerId and userId required" });
      if (Number(partnerId) === Number(userId))
        return res.status(400).json({ error: "Cannot message yourself" });

      const conversation = await ChatModel.findOrCreateConversation(
        Number(userId),
        Number(partnerId),
        serviceId ?? null
      );
      res.json(conversation);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to start conversation" });
    }
  },

  async getUserChats(req, res) {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: "userId required" });
      const chats = await ChatModel.getConversations(Number(userId));
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
      const { conversationId, content, userId, receiverId } = req.body;
      if (!content || !content.trim())
        return res.status(400).json({ error: "Message content required" });

      const message = await ChatModel.createMessage(conversationId, Number(userId), content.trim());

      if (receiverId) {
        let notificationText = content.trim();
        try {
          const parsed = JSON.parse(content);
          if (parsed.type === 'quotation') {
            const count = parsed.items?.length ?? 1;
            notificationText = `sent a quotation: ${count} item(s) — ${parsed.amount} TND`;
          }
        } catch (e) { /* regular message */ }
        await ChatModel.createNotification(receiverId, 'message', userId, notificationText);
      }

      res.json(message);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Message failed" });
    }
  },

  async respondToQuotation(req, res) {
    try {
      const { messageId, content, receiverId, senderId, conversationId } = req.body;
      console.log('respondToQuotation body:', { messageId, receiverId, senderId, conversationId });

      const updatedMessage = await ChatModel.updateQuotationStatus(messageId, content);

      let statusLabel  = "updated";
      let parsedContent = null;
      try {
        parsedContent = JSON.parse(content);
        statusLabel   = parsedContent.status;
      } catch (e) { statusLabel = content; }
       console.log('statusLabel:', statusLabel);
    console.log('parsedContent:', parsedContent);


      if (receiverId && senderId) {
        await ChatModel.createNotification(
          receiverId, 'quotation_update', senderId,
          `Your quotation was ${statusLabel}`
        );
      }

      // Create booking when accepted
      if (statusLabel === 'accepted' && parsedContent && conversationId) {
        try {
          const convRes  = await pool.query(
            'SELECT service_id FROM conversations WHERE id = $1', [conversationId]
          );
          console.log('conversation row:', convRes.rows[0]);

          const serviceId = convRes.rows[0]?.service_id;
          console.log('Creating booking with:', { senderId, receiverId, startDate: parsedContent.startDate, amount: parsedContent.amount, serviceId });

          const booking = await ChatModel.createBookingFromQuotation(
              senderId,
              receiverId,
              parsedContent.startDate,
              parsedContent.amount,
              serviceId
            );
          console.log('Booking created:', booking);

        } catch (bookingErr) {
          console.error('Full error:', bookingErr);
          console.error('Booking creation failed:', bookingErr.message);
        }
      }else {
      // LOG 7 — why we skipped booking creation
      console.log('Skipped booking creation because:', {
        isAccepted: statusLabel === 'accepted',
        hasParsedContent: !!parsedContent,
        hasConversationId: !!conversationId
      });
    }


      res.json(updatedMessage);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },

  async getNotifications(req, res) {
    try {
      const { userId } = req.query;
      const notifications = await ChatModel.getNotifications(userId);
      res.json(notifications);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  },

  async markNotificationsRead(req, res) {
    try {
      const { userId } = req.body;
      await ChatModel.markAllAsRead(userId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update notifications" });
    }
  },
};

module.exports = chatController;