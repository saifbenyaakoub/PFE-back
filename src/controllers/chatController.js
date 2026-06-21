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

      // Conversations no longer carry a task_id — a conversation isn't
      // reliably tied to a single task (a client can have several open
      // tasks with the same provider at once), so task linkage now happens
      // per-quotation instead (see respondToQuotation / parsedContent.taskId).
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
      console.log(`Fetched `, messages);
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

      let statusLabel   = "updated";
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
          // serviceId still falls back to the conversation's service_id for
          // older quotations sent before serviceId was added to the
          // quotation payload itself.
          let serviceId = parsedContent.serviceId ?? null;

          if (!serviceId) {
            const convRes = await pool.query(
              'SELECT service_id FROM conversations WHERE id = $1', [conversationId]
            );
            serviceId = convRes.rows[0]?.service_id ?? null;
          }

          // taskId comes directly from the quotation itself (set when the
          // provider optionally picks one of the client's open tasks in
          // the quotation form), never from the conversation. A
          // conversation is not reliably tied to a single task — a client
          // can have multiple simultaneously-open tasks with the same
          // provider — so per-quotation selection is the only unambiguous
          // source. null/undefined here just means "not linked to a task",
          // which is a valid, expected case.
          const taskId = parsedContent.taskId ?? null;

          console.log('Creating booking with:', { senderId, receiverId, startDate: parsedContent.startDate, amount: parsedContent.amount, serviceId, taskId });

          const booking = await ChatModel.createBookingFromQuotation(
            senderId,
            receiverId,
            parsedContent.startDate,
            parsedContent.amount,
            serviceId,
            taskId
          );
          console.log('Booking created:', booking);
        } catch (bookingErr) {
          console.error('Full error:', bookingErr);
          console.error('Booking creation failed:', bookingErr.message);
        }
      } else {
        console.log('Skipped booking creation because:', {
          isAccepted:        statusLabel === 'accepted',
          hasParsedContent:  !!parsedContent,
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

  // Returns the list of services owned by a provider so the frontend can
  // pre-populate quotation line items from a dropdown.
  async getProviderServices(req, res) {
    try {
      const { providerId } = req.query;
      if (!providerId) return res.status(400).json({ error: "providerId required" });
      const services = await ChatModel.getProviderServices(Number(providerId));
      res.json(services);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch provider services" });
    }
  },

  // Returns a client's currently-open tasks so the provider can optionally
  // link a quotation to a specific one. This replaces the old approach of
  // tagging the conversation with a task_id (set on "Book Now") — that was
  // fragile because a conversation isn't reliably tied to a single task,
  // and a client can have multiple simultaneously-open tasks with the same
  // provider. Picking explicitly per-quotation removes the ambiguity.
  async getClientOpenTasks(req, res) {
    try {
      const { clientId } = req.query;
      if (!clientId) return res.status(400).json({ error: "clientId required" });
      const tasks = await ChatModel.getClientOpenTasks(Number(clientId));
      res.json(tasks);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch client tasks" });
    }
  },
};

module.exports = chatController;