const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
// All chat routes protected by auth

router.get('/conversations', chatController.getUserChats);
router.get('/messages/:conversationId', chatController.getChatHistory);
router.post('/message', chatController.sendMessage);

module.exports = router;