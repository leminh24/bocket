const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const verifyToken = require('../middleware/authMiddleware'); //

// Route xử lý bình luận ảnh chuyển thành chat
router.post('/comment-to-chat', verifyToken, messageController.commentToChat);
router.get('/messages/:friendId', verifyToken, messageController.getMessages);
router.get('/partners', verifyToken, messageController.getChatPartners);
router.post('/send', verifyToken, messageController.sendMessage);

module.exports = router;