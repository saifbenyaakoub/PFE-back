require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

// Models
const ChatModel = require("./models/chat");

// Routes
const serviceRoutes = require("./routes/serviceRouter");
const tasksRoutes = require("./routes/tasksRouter");
const authRoutes = require("./auth");
const profileRoutes = require("./routes/profileRouter");
const chatRouter = require("./routes/chatRouter");
const adminRouter = require("./routes/adminRouter");
const aiRoutes = require("./routes/aiRouter");
const bookingsRoutes  = require('./routes/bookings');
const servicesRoutes  = require('./routes/services');
const reviewsRoutes   = require('./routes/reviews');
const dashboardRoutes = require('./routes/dashboard');
const { authenticateToken } = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);
app.use("/services", serviceRoutes);
app.use("/tasks", tasksRoutes);
app.use("/chat", chatRouter);
app.use("/admin", adminRouter);
app.use('/bookings',  authenticateToken, bookingsRoutes);
app.use('/services',  authenticateToken, servicesRoutes);
app.use('/reviews',   authenticateToken, reviewsRoutes);
app.use('/dashboard', authenticateToken, dashboardRoutes);
app.use("/ai", aiRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id);

  // 1. Join Private Notification Room (Used by Navbar)
  socket.on("joinUserNotifications", (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their notification room.`);
  });

  // 2. Join Conversation Room (Used by Chat window)
  socket.on("joinConversation", (conversationId) => {
    socket.join(`conv_${conversationId}`);
  });

  socket.on("leaveConversation", (conversationId) => {
    socket.leave(`conv_${conversationId}`);
  });

  // 3. Merged Handle Messages & Notification Trigger
  socket.on("sendMessage", async ({ conversationId, content, userId, receiverId }) => {
    if (!content || !content.trim()) return;

    try {
      // SAVE TO DB: Create the message
      const message = await ChatModel.createMessage(
        conversationId, 
        Number(userId), 
        content.trim()
      );
      
      // EMIT: Send to the active chat room
      socket.to(`conv_${conversationId}`).emit("receiveMessage", message);

      if (receiverId) {
        // SAVE TO DB: Create a notification for the receiver
        const notification = await ChatModel.createNotification(
          receiverId, 
          'message', 
          userId, 
          content.trim()
        );

        // EMIT: Trigger the Toast/Bell Notification for the Receiver
        io.to(`user_${receiverId}`).emit("newMessageNotification", {
          id: notification.id,
          senderName: message.sender_name,
          senderImage: message.sender_image,
          text: content.trim(),
          conversationId,
          time: "Just now"
        });
      }

      // EMIT: Specifically notify both users to refresh their sidebar/conversation list
      const updatePayload = { 
        conversationId, 
        last_message: content.trim(), 
        last_message_time: message.created_at 
      };
      io.to(`user_${userId}`).to(`user_${receiverId}`).emit("conversationUpdated", updatePayload);

    } catch (err) {
      console.error("❌ sendMessage error:", err);
    }
  });

  // 4. Merged Handle Quotation Status Notifications
  socket.on("quotationResponse", async ({ messageId, status, conversationId, receiverId, senderId }) => {
    try {
      const text = `Your quotation was ${status}`;
      
      // EMIT: Update the chat window UI
      io.to(`conv_${conversationId}`).emit("quotationUpdated", { 
        messageId, 
        status, 
        conversationId 
      });

      if (receiverId && senderId) {
        // SAVE TO DB: Record the status change notification
        const notification = await ChatModel.createNotification(
          receiverId, 
          'quotation_update', 
          senderId, 
          text
        );

        // EMIT: Trigger the Toast/Bell Notification
        io.to(`user_${receiverId}`).emit("notification", {
          
          id: notification.id,
          icon: status === 'accepted' ? "✅" : "❌",
          text: text,
          time: "Just now"
        });
      }
    } catch (err) {
      console.error("❌ quotationResponse error:", err);
    }
  });

  socket.on("typing", (conversationId) => {
    socket.to(`conv_${conversationId}`).emit("userTyping", { conversationId });
  });

  socket.on("stopTyping", (conversationId) => {
    socket.to(`conv_${conversationId}`).emit("userStopTyping", { conversationId });
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});