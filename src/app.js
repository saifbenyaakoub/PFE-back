require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http"); // FIXED: Added import
const { Server } = require("socket.io"); // FIXED: Added import

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

// Initialize Socket.io
const io = new Server(server, {
  cors: { 
    origin: "http://localhost:3000", // Standard React port
    methods: ["GET", "POST"]
  }
});



// Socket logic
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('joinConversation', (conversationId) => {
    socket.join(conversationId);
    console.log(`Socket ${socket.id} joined room ${conversationId}`);
  });

  socket.on('sendMessage', (messageData) => {
    // This sends the message to everyone in the room except the sender
    socket.to(messageData.conversation_id).emit('receiveMessage', messageData);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start server (Use 'server.listen', NOT 'app.listen')
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});