const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const { authenticateToken } = require("../middleware/authMiddleware"); // Optional but recommended

router.get("/conversations", chatController.getUserChats);
router.get("/messages/:conversationId", chatController.getChatHistory);
router.post("/start", chatController.startConversation);
router.post("/send", chatController.sendMessage);
router.post("/quotation/respond", chatController.respondToQuotation);

// Secured notification routes
router.get("/notifications", authenticateToken, chatController.getNotifications);
router.post("/notifications/read", authenticateToken, chatController.markNotificationsRead);

module.exports = router;