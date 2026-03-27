require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

// Models
const ChatModel = require("./models/chat");

// Routes
const serviceRoutes = require("./routes/serviceRouter");
const tasksRoutes = require("./routes/tasksRouter");
const authRoutes = require("./auth");
const profileRoutes = require("./routes/profileRouter");
const chatRouter = require("./routes/chatRouter");

// Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Use routes
app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);
app.use("/services", serviceRoutes);
app.use("/tasks", tasksRoutes);
app.use("/chat", chatRouter);

// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// ─── Socket.IO JWT Authentication Middleware ─────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication required"));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "0123456789");
    // Normalize: JWT uses "userId" but socket handlers expect "id"
    socket.user = { ...decoded, id: decoded.userId || decoded.id };
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

// ─── Track online users: userId → Set<socketId> ─────────────────
const onlineUsers = new Map();

io.on("connection", (socket) => {
  const userId = socket.user.id;
  console.log(`User ${userId} connected (socket: ${socket.id})`);

  // Track online status
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socket.id);

  // Join a conversation room
  socket.on("joinConversation", (conversationId) => {
    socket.join(`conv_${conversationId}`);
  });

  // Leave a conversation room
  socket.on("leaveConversation", (conversationId) => {
    socket.leave(`conv_${conversationId}`);
  });

  // Send message — save to DB then broadcast
  socket.on("sendMessage", async ({ conversationId, text }) => {
    if (!text || !text.trim()) return;

    try {
      // Persist the message in DB
      const message = await ChatModel.createMessage(conversationId, userId, text.trim());

      // Attach sender info for the frontend
      const fullMessage = {
        ...message,
        sender_name: socket.user.name || "User",
        sender_image: socket.user.profile_image || null,
      };

      // Broadcast to everyone in the room (including sender)
      io.to(`conv_${conversationId}`).emit("receiveMessage", fullMessage);
    } catch (err) {
      console.error("Socket sendMessage error:", err);
      socket.emit("messageError", { error: "Failed to send message" });
    }
  });

  // Mark messages as read
  socket.on("markAsRead", async (conversationId) => {
    try {
      await ChatModel.markAsRead(conversationId, userId);
      // Notify the other user that messages were read
      socket.to(`conv_${conversationId}`).emit("messagesRead", {
        conversationId,
        readBy: userId,
      });
    } catch (err) {
      console.error("Socket markAsRead error:", err);
    }
  });

  // Typing indicators
  socket.on("typing", (conversationId) => {
    socket.to(`conv_${conversationId}`).emit("userTyping", {
      conversationId,
      userId,
    });
  });

  socket.on("stopTyping", (conversationId) => {
    socket.to(`conv_${conversationId}`).emit("userStopTyping", {
      conversationId,
      userId,
    });
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log(`User ${userId} disconnected (socket: ${socket.id})`);
    const sockets = onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) onlineUsers.delete(userId);
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
