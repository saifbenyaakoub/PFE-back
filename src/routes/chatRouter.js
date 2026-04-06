const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");

router.get("/conversations", chatController.getUserChats);
router.get("/messages/:conversationId", chatController.getChatHistory);
router.post("/start", chatController.startConversation);
router.post("/send", chatController.sendMessage);
router.post("/quotation/respond", chatController.respondToQuotation);

module.exports = router;