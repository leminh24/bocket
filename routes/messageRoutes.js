const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const verifyToken = require('../middleware/authMiddleware'); //

// Route xử lý bình luận ảnh chuyển thành chat
router.post('/comment-to-chat', verifyToken, messageController.commentToChat);

module.exports = router;