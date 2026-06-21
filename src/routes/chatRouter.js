const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const { authenticateToken } = require("../middleware/authMiddleware");

router.get("/conversations", chatController.getUserChats);
router.get("/messages/:conversationId", chatController.getChatHistory);
router.post("/start", chatController.startConversation);
router.post("/send", chatController.sendMessage);
router.post("/quotation/respond", chatController.respondToQuotation);

// Returns the provider's own services for the quotation modal dropdown
router.get("/provider-services", authenticateToken, chatController.getProviderServices);

// Returns the client's currently-open posted tasks, so the provider can
// optionally link a quotation to one in the quotation modal's task selector.
router.get("/client-tasks", authenticateToken, chatController.getClientOpenTasks);

// Secured notification routes
router.get("/notifications", authenticateToken, chatController.getNotifications);
router.post("/notifications/read", authenticateToken, chatController.markNotificationsRead);

module.exports = router;