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

//const bookingsRoutes  = require('./routes/bookings');
const servicesRoutes  = require('./routes/services');
const reviewsRoutes   = require('./routes/reviews');
//const savedRoutes     = require('./routes/saved');
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

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },})
//app.use('/bookings',  authenticateToken, bookingsRoutes);
app.use('/services',  authenticateToken, servicesRoutes);
app.use('/reviews',   authenticateToken, reviewsRoutes);
//app.use('/saved',     authenticateToken, savedRoutes);
app.use('/dashboard', authenticateToken, dashboardRoutes);



io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id);

  socket.on("joinConversation", (conversationId) => {
    socket.join(`conv_${conversationId}`);
  });

  socket.on("leaveConversation", (conversationId) => {
    socket.leave(`conv_${conversationId}`);
  });

  socket.on("sendMessage", async ({ conversationId, content, userId }) => {
    if (!content || !content.trim()) return;

    try {
      const message = await ChatModel.createMessage(
        conversationId,
        userId,
        content.trim()
      );

      // ✅ FIX: Send to everyone in the room EXCEPT the sender
      socket.to(`conv_${conversationId}`).emit("receiveMessage", message);

      // Update sidebar for both users
      io.emit("conversationUpdated", {
        conversationId,
        last_message: content.trim(),
        sender_id: userId,
      });

    } catch (err) {
      console.error("❌ sendMessage error:", err);
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