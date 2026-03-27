const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const { authenticateToken } = require("../middleware/authMiddleware");

// All chat routes require authentication
router.use(authenticateToken);

router.post("/conversations", chatController.startConversation);
router.get("/conversations", chatController.getUserChats);
router.get("/messages/:conversationId", chatController.getChatHistory);
router.post("/message", chatController.sendMessage);

module.exports = router;
